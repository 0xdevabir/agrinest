import { Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { farmerOut } from "../common/presenters";
import { CreateFarmerDto } from "./dto/create-farmer.dto";

@Controller("farmers")
export class FarmersController {
  constructor(private readonly db: DatabaseService) {}

  @Post()
  async create(@Body() body: CreateFarmerDto) {
    const farmer = await this.db.farmer.create({
      data: { name: body.name, district: body.district, phone: body.phone ?? null, lang: body.lang ?? "bn" },
    });
    return farmerOut(farmer);
  }

  @Get()
  async list() {
    const rows = await this.db.farmer.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(farmerOut);
  }

  @Get(":farmerId")
  async get(@Param("farmerId") farmerId: string) {
    const farmer = await this.db.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) throw new NotFoundException("কৃষক পাওয়া যায়নি");
    return farmerOut(farmer);
  }
}
