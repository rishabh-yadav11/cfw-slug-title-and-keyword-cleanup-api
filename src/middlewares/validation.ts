import { Context } from "hono";

export const handleZodError = (result: any, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed",
          details: result.error.errors,
        },
        request_id: c.get("requestId"),
      },
      400,
    );
  }
};
