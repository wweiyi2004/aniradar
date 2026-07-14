export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureDatabase } = await import("@aniradar/db");
    await configureDatabase();
  }
}
