import postgres from "postgres";

// Use an empty string if DATABASE_URL is not set so it doesn't crash on import,
// but it will fail when trying to query.
const sql = postgres(process.env.DATABASE_URL || "", {
  // Add any specific connection options here if needed, e.g. ssl for production
});

export default sql;

export const isPostgresConfigured = () => {
  return Boolean(process.env.DATABASE_URL);
};
