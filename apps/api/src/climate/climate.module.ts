import { Module } from "@nestjs/common";
import { ClimateController } from "./climate.controller";

@Module({ controllers: [ClimateController] })
export class ClimateModule {}
