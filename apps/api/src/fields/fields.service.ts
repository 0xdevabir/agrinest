import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { eventOut, fieldOut, jsonValue } from "../common/presenters";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateFieldDto } from "./dto/create-field.dto";

@Injectable()
export class FieldsService {
  constructor(private readonly db: DatabaseService) {}

  async require(fieldId: string) {
    const field = await this.db.field.findUnique({ where: { id: fieldId }, include: { farmer: true } });
    if (!field) throw new NotFoundException("জমি পাওয়া যায়নি");
    if (!field.farmer) throw new NotFoundException("কৃষক পাওয়া যায়নি");
    return field;
  }

  async create(body: CreateFieldDto) {
    const farmer = await this.db.farmer.findUnique({ where: { id: body.farmer_id } });
    if (!farmer) throw new NotFoundException("কৃষক পাওয়া যায়নি");
    const field = await this.db.field.create({
      data: {
        farmerId: body.farmer_id,
        crop: body.crop ?? "rice",
        variety: body.variety ?? "BRRI dhan28",
        sowingDate: body.sowing_date,
        lat: body.lat ?? 25.7439,
        lon: body.lon ?? 89.2752,
        areaHa: body.area_ha ?? 0.8,
        locationLabel: body.location_label ?? "রংপুর",
      },
    });
    return fieldOut(field);
  }

  async list(farmerId?: string) {
    const rows = await this.db.field.findMany({ where: farmerId ? { farmerId } : undefined });
    return rows.map(fieldOut);
  }

  async get(fieldId: string) {
    return fieldOut(await this.require(fieldId));
  }

  async events(fieldId: string) {
    await this.require(fieldId);
    const rows = await this.db.event.findMany({ where: { fieldId }, orderBy: { createdAt: "desc" } });
    return rows.map(eventOut);
  }

  async append(fieldId: string, body: CreateEventDto) {
    await this.require(fieldId);
    const event = await this.db.event.create({
      data: { fieldId, type: body.type, payload: jsonValue(body.payload ?? {}) },
    });
    return eventOut(event);
  }
}

