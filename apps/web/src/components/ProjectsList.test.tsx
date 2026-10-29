import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsList, type ProjectCardData } from "./ProjectsList";

const card = (o: Partial<ProjectCardData> = {}): ProjectCardData => ({
  id: "p1",
  name: "Ali Khan",
  city: "Karachi",
  model: 2,
  category: "B",
  status: "FINALIZED",
  hasRender: false,
  imageUrl: "/demo.jpg",
  createdLabel: "1 Oct 2026",
  valueLabel: "Rs 1,500,000",
  modelLabel: "Construction on Client's Plot",
  categoryLabel: "Category B · Standard",
  ...o,
});
const set = [
  card(),
  card({
    id: "p2",
    name: "Sara Noor",
    city: "Lahore",
    category: "A",
    status: "NEW",
    valueLabel: null,
  }),
  card({
    id: "p3",
    name: "Bilal Shah",
    city: "Multan",
    category: "C",
    status: "CAD_UPLOADED",
  }),
];
const names = () => screen.queryAllByRole("link").map((l) => l.textContent);

describe("ProjectsList", () => {
  it("renders a linked card per project", () => {
    render(<ProjectsList projects={set} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /ali khan/i })).toHaveAttribute(
      "href",
      "/office/p1",
    );
  });

  it("shows the value, or the created date when there is no BOQ", () => {
    render(<ProjectsList projects={set} />);
    expect(screen.getAllByText("Project Value")).toHaveLength(2);
    expect(screen.getAllByText("Created")).toHaveLength(1);
    expect(screen.getAllByText("Rs 1,500,000").length).toBeGreaterThan(0);
  });

  it("filters by free text across name, city, model and category", async () => {
    render(<ProjectsList projects={set} />);
    const user = userEvent.setup();
    const box = screen.getByLabelText("Search projects");
    await user.type(box, "lahore");
    expect(names()).toHaveLength(1);
    expect(names()[0]).toMatch(/sara noor/i);
    await user.clear(box);
    await user.type(box, "premium");
    expect(names()).toHaveLength(0);
    await user.clear(box);
    await user.type(box, "cad uploaded");
    expect(names()[0]).toMatch(/bilal shah/i);
  });

  it("filters by status and category together", async () => {
    render(<ProjectsList projects={set} />);
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText("Filter by status"),
      "FINALIZED",
    );
    expect(names()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText("Filter by category"), "A");
    expect(
      screen.getByText("No projects match your filters"),
    ).toBeInTheDocument();
  });

  it("starts with the initial query", () => {
    render(<ProjectsList projects={set} initialQuery="multan" />);
    expect(screen.getByLabelText("Search projects")).toHaveValue("multan");
    expect(names()).toHaveLength(1);
  });

  it("the Filters button is disabled until a filter is set, then resets all", async () => {
    render(<ProjectsList projects={set} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Filters" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Filter by status"), "NEW");
    const reset = screen.getByRole("button", { name: "Reset" });
    expect(reset).toBeEnabled();
    await user.click(reset);
    expect(names()).toHaveLength(3);
    expect(screen.getByLabelText("Filter by status")).toHaveValue("");
  });

  it("explains an empty list differently from an empty filter result", () => {
    const { unmount } = render(<ProjectsList projects={[]} />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    unmount();
    render(<ProjectsList projects={set} initialQuery="nothing-matches" />);
    expect(
      screen.getByText("No projects match your filters"),
    ).toBeInTheDocument();
  });

  it("shows a render thumbnail only when one exists", () => {
    const { container, rerender } = render(
      <ProjectsList projects={[card()]} />,
    );
    expect(container.querySelector("img")).toBeNull();
    rerender(
      <ProjectsList
        projects={[card({ hasRender: true, imageUrl: "/r.png" })]}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "/r.png");
    expect(screen.getByText(/render ready/)).toBeInTheDocument();
  });
});
