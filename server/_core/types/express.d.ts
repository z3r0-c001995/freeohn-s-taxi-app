import "express-serve-static-core";
import type { User } from "../../../drizzle/schema";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: User;
  }
}

