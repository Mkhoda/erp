import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { AssetCategoriesService } from './categories.service';
import { AssetCategoriesController } from './categories.controller';
import { AssetAssignmentsController } from './assignments.controller';
import { AssetsReportController } from './reports.controller';
import { UploadController } from './upload.controller';
import { BuildingsController } from './buildings.controller';
import { FloorsController } from './floors.controller';
import { RoomsController } from './rooms.controller';
import { AssetTypesController } from './types.controller';

@Module({
  controllers: [AssetsController, AssetCategoriesController, AssetAssignmentsController, AssetsReportController, UploadController, BuildingsController, FloorsController, RoomsController, AssetTypesController],
  providers: [AssetsService, AssetCategoriesService, PrismaService],
})
export class AssetsModule {}
