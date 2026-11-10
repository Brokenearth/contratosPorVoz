import { expect, test, type Page } from "@playwright/test";

const SCREENSHOTS = "docs/screenshots";

async function analyze(page: Page, text: string) {
  await page.getByLabel("Texto del contrato").fill(text);
  await page.getByRole("button", { name: "Analizar" }).click();
}

/** Clicks "Descargar .md" and returns the file name and content. */
async function downloadContract(page: Page): Promise<{ name: string; content: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar .md" }).click(),
  ]);
  let content = "";
  for await (const chunk of await download.createReadStream()) content += String(chunk);
  return { name: download.suggestedFilename(), content };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Contratos rurales por voz" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Leer guía/ })).toHaveCount(0);
});

test("pastoreo: demo phrase generates and downloads the contract", async ({ page }) => {
  await page.screenshot({ path: `${SCREENSHOTS}/00-inicio.png`, fullPage: true });
  await page.getByRole("button", { name: "Pastoreo (leche)" }).click();
  await page.getByRole("button", { name: "Analizar" }).click();
  const contract = page.getByRole("article", { name: "Contrato" });
  await expect(contract).toContainText("CONTRATO DE ARRENDAMIENTO DE LOTE PARA PASTOREO");
  await page.screenshot({ path: `${SCREENSHOTS}/01-pastoreo.png`, fullPage: true });

  const file = await downloadContract(page);
  expect(file.name).toBe("contrato-pastoreo.md");
  expect(file.content).toContain(
    "CLÁUSULA SEGUNDA. El ARRENDATARIO podrá mantener en el lote La Esperanza (5 hectáreas) un máximo de 20 vacas de raza Holstein, destinadas exclusivamente a la producción de leche, durante 12 meses.",
  );
  expect(file.content).not.toContain("{{");
  expect(file.content).not.toMatch(/borrador|generado automáticamente/i);
});

test("cultivo: missing-fields dialog, answer completes and downloads", async ({ page }) => {
  await analyze(
    page,
    "arriendo el lote El Porvenir de 3 hectáreas para cultivo de maíz por 6 meses, los insumos los aporta el arrendatario",
  );
  await expect(page.getByText("Falta la fecha y el valor del arrendamiento.")).toBeVisible();
  await expect(page.getByRole("article", { name: "Contrato" })).toHaveCount(0);
  await page.screenshot({ path: `${SCREENSHOTS}/02-faltantes.png`, fullPage: true });

  await page.getByLabel("Su respuesta").fill("desde el 1 de diciembre de 2026 por un valor de 2 millones de pesos");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText(/Todos los campos requeridos están completos/)).toBeVisible();

  const file = await downloadContract(page);
  expect(file.name).toBe("contrato-cultivo.md");
  expect(file.content).toContain("maíz");
  expect(file.content).toContain("$ 2.000.000 pesos");
  expect(file.content).toContain("1 de diciembre de 2026");
  expect(file.content).not.toContain("{{");
  expect(file.content).not.toMatch(/borrador|generado automáticamente/i);
});

test("mixta: generates and downloads, theory panels and Turing machine", async ({ page }) => {
  await page.getByRole("button", { name: "Mixta" }).click();
  await page.getByRole("button", { name: "Analizar" }).click();
  await expect(page.getByRole("article", { name: "Contrato" })).toBeVisible();

  const file = await downloadContract(page);
  expect(file.name).toBe("contrato-mixta.md");
  expect(file.content).toContain("15 vacas");
  expect(file.content).toContain("maíz");
  expect(file.content).toContain("$ 8.000.000 pesos");

  await expect(page.getByRole("tablist", { name: "Paneles de teoría" })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir laboratorio educativo" }).click();
  await page.getByRole("tab", { name: "Máquina de Turing" }).click();
  await expect(page.getByTestId("mt-estado")).toHaveText("q_buscar");
  await page.getByRole("button", { name: "Paso" }).click();
  await expect(page.getByText(/Instantánea 2 de/)).toBeVisible();
  await page.getByRole("tabpanel").screenshot({ path: `${SCREENSHOTS}/03-maquina-turing.png` });

  await page.getByRole("tab", { name: "Pila" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Z0");
  await page.getByRole("tab", { name: "Autómata del léxico" }).click();
  await expect(page.getByRole("img", { name: "Recorrido de la cadena sobre el AFD" })).toBeVisible();
  await page.getByRole("tabpanel").screenshot({ path: `${SCREENSHOTS}/04-automata.png` });
});

test("generate anyway leaves pending markers", async ({ page }) => {
  await analyze(page, "arriendo lote La Esperanza para 20 vacas de raza holstein");
  await page.getByRole("button", { name: "Generar de todos modos" }).click();
  const contract = page.getByRole("article", { name: "Contrato" });
  await expect(contract.locator("mark[data-pending]").first()).toBeVisible();
  const file = await downloadContract(page);
  expect(file.content).toContain("{{valor}}");
});

for (const [kind, use] of [
  ["pastoreo", "para 4 vacas para ceba"],
  ["cultivo", "para cultivo de maíz"],
  ["mixta", "para 4 vacas para ceba y para cultivo de maíz"],
] as const) {
  test(`${kind}: reviewed party names appear in the downloaded header and signatures`, async ({ page }) => {
    await analyze(
      page,
      `arrendador nombre Luis Toro lote 20 de 3 hectáreas ${use} ` +
        "por 6 meses desde el 1 de diciembre de 2026 valor 2 millones de pesos, el arrendatario aporta los insumos",
    );
    await expect(page.getByLabel("Arrendador", { exact: true })).toHaveValue("Luis Toro");
    await page.getByLabel("Arrendador", { exact: true }).fill("Juan de la Cruz");
    await page.getByLabel("Arrendatario", { exact: true }).fill("María José Gómez");
    await page.getByRole("button", { name: "Confirmar nombres" }).click();
    const { content, name } = await downloadContract(page);
    expect(name).toBe(`contrato-${kind}.md`);
    const [header, signatures] = content.split("## FIRMAS");
    expect(header).toContain("Entre los suscritos, Juan de la Cruz");
    expect(header).toContain("María José Gómez");
    expect(signatures).toMatch(/\| Juan de la Cruz\s+\| María José Gómez\s+\|/);
    expect(content).not.toContain("Luis Toro");
  });
}

test("confirms who holds a role when the phrasing is ambiguous", async ({ page }) => {
  const agreement = "lote 20 para cultivo de maíz desde el 2 de marzo valor 900 mil pesos";
  await analyze(page, agreement + ", el vecino Juan quien sería el arrendador, la arrendataria es Ana Gómez");
  await expect(page.getByLabel("Arrendador", { exact: true })).toHaveValue("Juan");
  await expect(page.getByLabel("Arrendatario", { exact: true })).toHaveValue("Ana Gómez");

  await analyze(page, agreement + ", el arrendador es Juan o Pedro, la arrendataria es Ana Gómez");
  await expect(page.getByText(/nombre asociado a «arrendador» es ambiguo/i)).toBeVisible();
  await expect(page.getByLabel("Arrendador", { exact: true })).toHaveValue("");
  await page.getByLabel("Arrendador", { exact: true }).fill("Juan Gomez");
  await page.getByRole("button", { name: "Confirmar nombres" }).click();
  const file = await downloadContract(page);
  expect(file.content).toContain("Entre los suscritos, Juan Gomez");
  expect(file.content).toMatch(/\| Juan Gomez\s+\| Ana Gómez\s+\|/);
});

test("repairs clear words and asks about ambiguous alternatives before generating", async ({ page }) => {
  await analyze(page, "lote 20 para 4 bombino de raza norolando para ceba desde el 2 de marzo valor 2 milones de pesos");
  await expect(page.getByText("«bombino» → «bovino»")).toBeVisible();
  await expect(page.getByText("«milones» → «millones»")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar Normando" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar Girolando" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar .md" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar Normando" }).click();
  const confirmed = await downloadContract(page);
  expect(confirmed.content).toContain("4 bovinos de raza Normando");
  expect(confirmed.content).toContain("$ 2.000.000 pesos");

  await analyze(page, "lote 20 para 4 baca de raza holste para ceba desde el 2 de marzo valor 900 mil pesos");
  await page.getByText("Transcripción original", { exact: true }).click();
  const review = page.getByRole("region", { name: "Revise los datos" });
  await expect(review.getByText(/4 baca de raza holste para ceba/)).toBeVisible();
  expect((await downloadContract(page)).content).toContain("4 vacas de raza Holstein");
});

test("a rejected answer keeps the previous draft and shows the cause", async ({ page }) => {
  await analyze(page, "lote 20 para cultivo de maíz");
  await page.getByRole("button", { name: "Generar de todos modos" }).click();
  const first = await downloadContract(page);
  expect(first.content).toContain("Borrador incompleto");
  await page.getByLabel("Su respuesta").fill("fin");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByRole("heading", { name: "Borrador anterior" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("'fin' sin 'de los cuales'");
  expect((await downloadContract(page)).content).toBe(first.content);
});

test("voice: a fake SpeechRecognition fills the editable textarea", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { __lang: string }).__lang = this.lang;
        const transcript =
          "arriendo el lote 12 de 4 hectáreas para cultivo de café por 2 años desde el 10 de enero de 2027 por un valor de 5 millones de pesos, el arrendador aporta los insumos";
        setTimeout(() => {
          const result = Object.assign([{ transcript }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [result] });
        }, 100);
      }
      stop() {
        this.onend?.();
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Dictar por voz" }).click();
  const field = page.getByLabel("Texto del contrato");
  await expect(field).toHaveValue(/cultivo de café/);
  expect(await page.evaluate(() => (window as unknown as { __lang: string }).__lang)).toBe("es-CO");

  await page.getByRole("button", { name: "Detener dictado" }).click();
  await field.fill(`${await field.inputValue()}, arrendatario Ana Gómez`);
  await page.getByRole("button", { name: "Analizar" }).click();
  const file = await downloadContract(page);
  expect(file.name).toBe("contrato-cultivo.md");
  expect(file.content).toContain("café");
  expect(file.content).toContain("Ana Gómez");
});

test("simulators: rejection, nested stack and final Turing state", async ({ page }) => {
  await page.getByRole("button", { name: "Pastoreo anidado" }).click();
  await page.getByRole("button", { name: "Analizar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir laboratorio educativo" }).click();
  await page.getByRole("tab", { name: "Autómata del léxico", exact: true }).click();
  await page.getByLabel("Cadena de prueba").fill("2x");
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await page.getByRole("button", { name: "Paso", exact: true }).click();
  await expect(page.getByRole("tabpanel").getByRole("status")).toContainText("No existe una transición para «x»");
  await page.getByRole("tab", { name: "Pila", exact: true }).click();
  await page.getByRole("slider").press("End");
  await expect(page.getByText("Pila vacía", { exact: true })).toBeVisible();
  await expect(page.getByText("Entrada aceptada", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Máquina de Turing", exact: true }).click();
  await expect(page.getByRole("img", { name: "Grafo de la máquina de Turing" })).toBeVisible();
  await page.getByRole("slider").press("End");
  await expect(page.getByTestId("mt-estado")).toHaveText("q_fin");
  await expect(page.getByLabel("Próxima transición")).toContainText("Estado de aceptación");
});

test("mobile: fits a narrow viewport and keeps diagrams usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Cultivo (maíz)" }).click();
  await page.getByRole("button", { name: "Analizar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir laboratorio educativo" }).click();
  await page.getByRole("tab", { name: "Máquina de Turing", exact: true }).click();
  await expect(page.getByRole("img", { name: "Grafo de la máquina de Turing" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("tabpanel").screenshot({ path: `${SCREENSHOTS}/05-mobile.png` });
});

test("voice: preserves pauses across browser restarts until seven seconds of silence", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-08T17:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-08T17:00:01Z"));
  await page.addInitScript(() => {
    class Recognition {
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        Object.assign(window, { __recognition: this });
      }
      stop() {
        this.onend?.();
      }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.reload();
  await page.getByRole("button", { name: "Dictar por voz" }).click();
  await page.evaluate(() => {
    const r = (window as unknown as { __recognition: { onresult: (e: unknown) => void } }).__recognition;
    r.onresult({
      resultIndex: 0,
      results: [Object.assign([{ transcript: "arriendo el lote 20" }], { isFinal: true })],
    });
  });
  await page.clock.runFor(4_000);
  await page.evaluate(() => (window as unknown as { __recognition: { onend: () => void } }).__recognition.onend());
  await page.clock.runFor(2_999);
  await expect(page.getByRole("button", { name: "Detener dictado" })).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByRole("button", { name: "Dictar por voz" })).toBeVisible();
  await expect(page.getByLabel("Texto del contrato")).toHaveValue("arriendo el lote 20");
});
