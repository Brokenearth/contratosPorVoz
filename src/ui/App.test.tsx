import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Contratos rurales por voz" })).toBeInTheDocument();
    expect(screen.getByText("en construcción")).toBeInTheDocument();
  });
});
