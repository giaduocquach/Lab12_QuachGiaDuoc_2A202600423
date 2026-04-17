import { loginAccount, logoutAccount, getCurrentStudent, verifyCurrentStudent } from "@/lib/auth";

describe("auth module", () => {
  beforeEach(() => {
    logoutAccount();
  });

  it("loginAccount succeeds with correct credentials", () => {
    const result = loginAccount("20210001", "1");
    expect(result.ok).toBe(true);
  });

  it("loginAccount fails with wrong password", () => {
    const result = loginAccount("20210001", "wrong");
    expect(result.ok).toBe(false);
  });

  it("loginAccount fails with unknown id", () => {
    const result = loginAccount("UNKNOWN", "1");
    expect(result.ok).toBe(false);
  });

  it("getCurrentStudent returns null before login", () => {
    expect(getCurrentStudent()).toBeNull();
  });

  it("getCurrentStudent returns student after login", () => {
    loginAccount("20210001", "1");
    const student = getCurrentStudent();
    expect(student?.id).toBe("20210001");
  });

  it("verifyCurrentStudent returns valid after login", () => {
    loginAccount("20210001", "1");
    const result = verifyCurrentStudent();
    expect(result.ok).toBe(true);
  });

  it("logoutAccount clears session", () => {
    loginAccount("20210001", "1");
    logoutAccount();
    expect(getCurrentStudent()).toBeNull();
  });
});
