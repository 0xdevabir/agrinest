import { Module } from "@nestjs/common";
import { FarmersController } from "./farmers.controller";

@Module({ controllers: [FarmersController] })
export class FarmersModule {}
