import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@agrisathi/database";
import { join } from "path";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL?.startsWith("file:")
      ? process.env.DATABASE_URL
      : `file:${join(process.cwd(), "agrisathi.db")}`;
    super({ datasources: { db: { url: absoluteSqlite(url) } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function absoluteSqlite(url: string): string {
  if (!url.startsWith("file:")) return url;
  const path = url.slice("file:".length);
  if (path.startsWith("/")) return url;
  const cleaned = path.replace(/^\.\//, "");
  return `file:${join(process.cwd(), cleaned)}`;
}
