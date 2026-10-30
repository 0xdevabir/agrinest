import { Controller, Get, Param, Query } from "@nestjs/common";
import { queryBool } from "../common/paths";
import { eventOut, jsonValue } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { buildClimateAlerts } from "../engines/climate.engine";
import { getWeather } from "../engines/weather.engine";
import { FieldsService } from "../fields/fields.service";

@Controller()
export class ClimateController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Get("fields/:fieldId/climate-alerts")
  async alerts(
    @Param("fieldId") fieldId: string,
    @Query("force_seed_weather") forceSeed?: string,
    @Query("persist") persist?: string,
  ) {
    const field = await this.fields.require(fieldId);
    const weather = await getWeather(field.lat, field.lon, queryBool(forceSeed, false));
    const built = buildClimateAlerts(weather, field.farmer.district);
    const events = queryBool(persist, true)
      ? await Promise.all(
          built.alerts.map((alert) =>
            this.db.event.create({ data: { fieldId, type: "weather_alert", payload: jsonValue(alert) } }),
          ),
        )
      : [];
    return { ...built, events: events.map(eventOut) };
  }
}

