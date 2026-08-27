import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../database/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const dummyEmail = "local@mirror.app";
  let user = await db.getUserByEmail(dummyEmail);
  if (!user) {
    user = await db.createUser({
      email: dummyEmail,
      name: "Local User",
      passwordHash: "dummy",
    });
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
