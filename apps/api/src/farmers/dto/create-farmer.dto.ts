import { IsOptional, IsString } from "class-validator";

export class CreateFarmerDto {
  @IsString()
  name!: string;

  @IsString()
  district!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}
