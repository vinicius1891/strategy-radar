import { IsObject } from 'class-validator';

export class UpdateParamsDto {
  // Mapa nome do parametro -> novo valor numerico
  @IsObject()
  params: Record<string, number>;
}
