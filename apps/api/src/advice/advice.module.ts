import { Module } from "@nestjs/common";
import { AdviceController } from "./advice.controller";

@Module({ controllers: [AdviceController] })
export class AdviceModule {}
