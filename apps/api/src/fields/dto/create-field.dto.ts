import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateFieldDto {
  @IsString()
  farmer_id!: string;

  @IsOptional()
  @IsString()
  crop?: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsString()
  sowing_date!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;

  @IsOptional()
  @IsNumber()
  area_ha?: number;

  @IsOptional()
  @IsString()
  location_label?: string;
}
