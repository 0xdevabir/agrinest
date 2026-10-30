import { Module } from "@nestjs/common";
import { YieldController } from "./yield.controller";

@Module({ controllers: [YieldController] })
export class YieldModule {}