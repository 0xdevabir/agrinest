import { Controller, Get, Param, Query } from "@nestjs/common";
import { agronomyBody, fetchDesk } from "../clients/services";
import { queryBool } from "../common/paths";
import { asRecord, eventOut, farmerOut, fieldOut } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { buildAdvice } from "../engines/advice.engine";
import { buildClimateAlerts } from "../engines/climate.engine";
import { marketHint } from "../engines/market.engine";
import { getWeather } from "../engines/weather.engine";
import { estimateYield } from "../engines/yield.engine";
import { FieldsService } from "../fields/fields.service";

@Controller()
export class DashboardController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("fields/:fieldId/dashboard")
  async dashboard(@Param("fieldId") fieldId: string, @Query("force_seed_weather") forceSeed?: string) {
    const field = await this.fields.require(fieldId);
    const events = await this.db.event.findMany({ where: { fieldId }, orderBy: { createdAt: "desc" } });
    const mapped = events.map((event) => ({
      id: event.id,
      type: event.type,
      payload: asRecord(event.payload),
      createdAt: event.createdAt,
    }));
    const seed = queryBool(forceSeed, true);
    const desk = await fetchDesk(
      agronomyBody({
        crop: field.crop,
        variety: field.variety,
        areaHa: field.areaHa,
        sowingDate: field.sowingDate,
        district: field.farmer.district,
        lat: field.lat,
        lon: field.lon,
        forceSeed: seed,
        events: mapped,
      }),
    );
    const weather = desk ? null : await getWeather(field.lat, field.lon, seed);
    const advice = desk?.advice ?? buildAdvice(field.crop, field.sowingDate, weather!);
    const climate = desk?.climate_alerts ?? buildClimateAlerts(weather!, field.farmer.district);
    const estimate =
      desk?.yield_estimate ??
      estimateYield(
        field.crop,
        field.variety,
        field.areaHa,
        mapped.map((event) => ({ type: event.type, payload: event.payload, createdAt: event.createdAt })),
      );
    const latest = events.find((event) => event.type === "diagnosis");
    return {
      farmer: farmerOut(field.farmer),
      field: fieldOut(field),
      advice: {
        ...advice,
        event: { id: "dashboard-advice", field_id: fieldId, type: "advice", payload: advice, created_at: null },
      },
      climate: { ...climate, events: [] },
      yield_estimate: estimate,
      market: marketHint(field.farmer.district),
      latest_diagnosis: latest ? eventOut(latest) : null,
      events: events.slice(0, 20).map(eventOut),
      services: { agronomy: desk?.service ?? "nest-fallback", market: "nest" },
    };
  }
}
