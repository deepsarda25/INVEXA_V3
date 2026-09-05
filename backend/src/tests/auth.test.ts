import { describe, expect, it } from "bun:test";
import { app } from "../index";

describe("Auth Module", () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: "password123",
  };

  it("should register a new user", async () => {
    const response = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("token");
    expect(data.user.username).toBe(testUser.username);
  });

  it("should not register a duplicate user", async () => {
    const response = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser),
      })
    );

    expect(response.status).toBe(409);
  });

  it("should login with correct credentials", async () => {
    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail: testUser.username,
          password: testUser.password,
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("token");
  });

  it("should not login with wrong password", async () => {
    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail: testUser.username,
          password: "wrongpassword",
        }),
      })
    );

    expect(response.status).toBe(401);
  });
});
