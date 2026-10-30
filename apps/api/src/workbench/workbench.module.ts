import { Module } from "@nestjs/common";
import { WorkbenchController } from "./workbench.controller";

@Module({ controllers: [WorkbenchController] })
export class WorkbenchModule {}
