import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { apiLogin } from "../api";

vi.mock("../api");

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders client-side Zod errors inline and does not call the api", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(apiLogin).not.toHaveBeenCalled();
  });

  it("renders a server error in the server-error strip", async () => {
    vi.mocked(apiLogin).mockRejectedValue({
      response: { data: { message: "Invalid email or password" } },
    });
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    const strip = await screen.findByText("Invalid email or password");
    expect(strip).toHaveAttribute("data-auth-error");
    expect(container.querySelectorAll("[data-auth-error]")).toHaveLength(1);
  });

  it("disables the submit button and changes its copy while submitting", async () => {
    vi.mocked(apiLogin).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    const button = await screen.findByRole("button", { name: "Signing in..." });
    expect(button).toBeDisabled();
  });
});
