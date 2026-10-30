import { Controller, Post } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Controller("seed")
export class SeedController {
  constructor(private readonly db: DatabaseService) {}

  @Post("rahim")
  async rahim() {
    const existing = await this.db.farmer.findFirst({ where: { name: "রহিম" }, include: { fields: true } });
    if (existing?.fields[0]) {
      return { farmer_id: existing.id, field_id: existing.fields[0].id, message: "already_seeded" };
    }
    const sowing = new Date();
    sowing.setDate(sowing.getDate() - 40);
    const sowingDate = sowing.toISOString().slice(0, 10);
    const farmer = await this.db.farmer.create({
      data: {
        name: "রহিম",
        district: "রংপুর",
        phone: "01700000000",
        lang: "bn",
        fields: {
          create: {
            crop: "rice",
            variety: "BRRI dhan28",
            sowingDate,
            lat: 25.7439,
            lon: 89.2752,
            areaHa: 0.8,
            locationLabel: "রংপুর",
          },
        },
      },
      include: { fields: true },
    });
    return {
      farmer_id: farmer.id,
      field_id: farmer.fields[0].id,
      message: "seeded",
      persona: { name_bn: "রহিম", district: "রংপুর", area_ha: 0.8, crop: "rice", sowing_date: sowingDate },
    };
  }

  @Post("reset")
  async reset() {
    await this.db.listing.deleteMany();
    await this.db.event.deleteMany();
    await this.db.field.deleteMany();
    await this.db.farmer.deleteMany();
    return { ok: true };
  }
}
