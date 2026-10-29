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
  await expect(page.getByText("Borrador informativo; no reemplaza la asesoría de un abogado")).toBeVisible();
});

test("pastoreo: demo phrase generates and downloads the contract", async ({ page }) => {
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
  await expect(page.getByText("Todos los campos requeridos están completos")).toBeVisible();

  const file = await downloadContract(page);
  expect(file.name).toBe("contrato-cultivo.md");
  expect(file.content).toContain("maíz");
  expect(file.content).toContain("$ 2.000.000 pesos");
  expect(file.content).toContain("1 de diciembre de 2026");
  expect(file.content).not.toContain("{{");
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

  await page.getByRole("tab", { name: "Máquina de Turing" }).click();
  await expect(page.getByTestId("mt-estado")).toHaveText("q_buscar");
  await page.getByRole("button", { name: "Paso" }).click();
  await expect(page.getByText(/Instantánea 2 de/)).toBeVisible();
  await page.getByRole("tabpanel").screenshot({ path: `${SCREENSHOTS}/03-maquina-turing.png` });

  await page.getByRole("tab", { name: "Pila" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Z0");
  await page.getByRole("tab", { name: "Autómata del léxico" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("AFN-λ (Thompson)");
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
          this.onend?.();
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

  await field.fill(`${await field.inputValue()}, arrendatario Ana Gómez`);
  await page.getByRole("button", { name: "Analizar" }).click();
  const file = await downloadContract(page);
  expect(file.name).toBe("contrato-cultivo.md");
  expect(file.content).toContain("café");
  expect(file.content).toContain("Ana Gómez");
});
