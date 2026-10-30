import { IsIn, IsObject, IsOptional } from "class-validator";

export class CreateEventDto {
  @IsIn(["diagnosis", "advice", "weather_alert", "treatment_logged", "sale"])
  type!: "diagnosis" | "advice" | "weather_alert" | "treatment_logged" | "sale";

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
