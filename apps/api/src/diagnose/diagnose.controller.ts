import { BadRequestException, Body, Controller, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { jsonValue, eventOut } from "../common/presenters";
import { DatabaseService } from "../database/database.service";
import { backupClassify, classifyLeaf, confidenceThreshold, preparePhoto } from "../engines/disease.engine";
import { FieldsService } from "../fields/fields.service";

@Controller()
export class DiagnoseController {
  constructor(
    private readonly fields: FieldsService,
    private readonly db: DatabaseService,
  ) {}

  @Post("fields/:fieldId/diagnose")
  @UseInterceptors(FileInterceptor("file"))
  async diagnose(
    @Param("fieldId") fieldId: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body("force_disease") forceDisease?: string,
  ) {
    await this.fields.require(fieldId);
    if (!file?.buffer?.length) throw new BadRequestException("ছবি খালি");
    if (file.buffer.length > 8_000_000) throw new BadRequestException("ছবি খুব বড়");
    const force = forceDisease || null;
    const photo = await preparePhoto(fieldId, file.buffer);
    let result = await classifyLeaf(photo.bytes, file.originalname, force);
    if (result.confidence < confidenceThreshold() || result.disease_id === "unknown") {
      result = await backupClassify(photo.bytes);
    }
    const event = await this.db.event.create({
      data: {
        fieldId,
        type: "diagnosis",
        payload: jsonValue({ ...result, photo_path: photo.name }),
      },
    });
    return { ...result, event: eventOut(event) };
  }

  @Post("fields/:fieldId/treatment-logged")
  async logTreatment(@Param("fieldId") fieldId: string) {
    await this.fields.require(fieldId);
    const event = await this.db.event.create({
      data: {
        fieldId,
        type: "treatment_logged",
        payload: jsonValue({ note_bn: "চিকিৎসা সম্পন্ন হয়েছে" }),
      },
    });
    return eventOut(event);
  }
}
