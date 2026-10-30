import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdviceModule } from "./advice/advice.module";
import { ClimateModule } from "./climate/climate.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DatabaseModule } from "./database/database.module";
import { DiagnoseModule } from "./diagnose/diagnose.module";
import { FarmersModule } from "./farmers/farmers.module";
import { FieldsModule } from "./fields/fields.module";
import { HealthModule } from "./health/health.module";
import { MarketModule } from "./market/market.module";
import { SeedModule } from "./seed/seed.module";
import { WorkbenchModule } from "./workbench/workbench.module";
import { YieldModule } from "./yield/yield.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    DatabaseModule,
    HealthModule,
    FarmersModule,
    FieldsModule,
    DiagnoseModule,
    AdviceModule,
    ClimateModule,
    YieldModule,
    MarketModule,
    DashboardModule,
    WorkbenchModule,
    SeedModule,
  ],
})
export class AppModule {}
