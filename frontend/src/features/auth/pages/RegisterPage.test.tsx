import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "./RegisterPage";
import { apiRegister } from "../api";

vi.mock("../api");

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First Name"), "Ada");
  await user.type(screen.getByLabelText("Last Name"), "Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.type(screen.getByLabelText("Password"), "Passw0rd!x");
  await user.type(screen.getByLabelText("Confirm Password"), "Passw0rd!x");
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders client-side Zod errors inline and does not call the api", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(
      screen.getByText("Password must be minimum 8 characters long")
    ).toBeInTheDocument();
    expect(apiRegister).not.toHaveBeenCalled();
  });

  it("shows an inline error when the passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("First Name"), "Ada");
    await user.type(screen.getByLabelText("Last Name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!x");
    await user.type(screen.getByLabelText("Confirm Password"), "Different1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(apiRegister).not.toHaveBeenCalled();
  });

  it("renders a server error in the server-error strip", async () => {
    vi.mocked(apiRegister).mockRejectedValue({
      response: { data: { message: "Email already registered" } },
    });
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    const strip = await screen.findByText("Email already registered");
    expect(strip).toHaveAttribute("data-auth-error");
  });

  it("disables the submit button and changes its copy while submitting", async () => {
    vi.mocked(apiRegister).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    const button = await screen.findByRole("button", {
      name: "Creating account...",
    });
    expect(button).toBeDisabled();
  });
});
