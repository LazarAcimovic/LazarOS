import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AuthGuard from "./AuthGuard";
import { useAuthStore } from "@/store/authStore";
import { apiGetMe } from "@/features/auth";

vi.mock("@/features/auth/api");

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<div>login screen</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<div>protected screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: null, isLoading: true });
  });

  it("redirects to /login when GET /auth/me answers 401", async () => {
    vi.mocked(apiGetMe).mockRejectedValue({ response: { status: 401 } });
    renderGuard();

    expect(await screen.findByText("login screen")).toBeInTheDocument();
    expect(screen.queryByText("protected screen")).not.toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("renders the protected route when GET /auth/me succeeds", async () => {
    vi.mocked(apiGetMe).mockResolvedValue({
      id: "u1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      created_at: "2026-01-01",
    });
    renderGuard();

    expect(await screen.findByText("protected screen")).toBeInTheDocument();
    expect(screen.queryByText("login screen")).not.toBeInTheDocument();
  });
});
