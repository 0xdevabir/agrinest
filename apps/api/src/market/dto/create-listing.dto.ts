import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateListingDto {
  @IsNumber()
  quantity_ton!: number;

  @IsOptional()
  @IsNumber()
  price_hint_bdt?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
