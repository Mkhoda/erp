import { SetMetadata } from '@nestjs/common';

export const PAGE_KEY = 'page';
export const Page = (page: string) => SetMetadata(PAGE_KEY, page);
