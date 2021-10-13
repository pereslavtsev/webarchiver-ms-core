import { Injectable } from '@nestjs/common';
import { Template } from 'mwn';

import { CiteTemplate } from '../interfaces';
import { TEMPLATES } from '../mocks/cite-templates.mock';

@Injectable()
export class CiteTemplatesService {
  private readonly data = TEMPLATES;

  findByName(name: string): CiteTemplate {
    return this.data.find((t) => t.name === name.toLowerCase());
  }

  isArchived(template: Template): boolean {
    const t = this.findByName(template.name as string);
    return t.archiveUrlParamAliases.some((param) => template.getParam(param));
  }

  hasUrl(template: Template): boolean {
    const t = this.findByName(template.name as string);
    return t.urlParamAliases.some((param) => template.getParam(param));
  }
}
