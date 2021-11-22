import { Injectable, OnModuleInit } from '@nestjs/common';
import { ApiPage, mwn } from 'mwn';
import { LoggableProvider } from '@pereslavtsev/webarchiver-misc';
import { Bunyan, RootLogger } from '@eropple/nestjs-bunyan';
import { InjectBot } from 'nest-mwn';
import { InjectRepository } from '@nestjs/typeorm';
import { Template, TemplateSettings as Settings } from '../models';
import { Repository } from 'typeorm';
import { isMainThread } from 'worker_threads';

function extractName(fullTitle: string) {
  const [, title] = fullTitle.split(':', 2);
  return title.toLowerCase();
}

type ListAliases = Template['aliases'][];
type CreateSettings = Pick<
  Settings,
  'defaultUrlParam' | 'archiveUrlParam' | 'titleParam' | 'archiveDateParam'
> &
  Partial<
    Pick<
      Settings,
      | 'archiveUrlParamAliases'
      | 'archiveDateParamAliases'
      | 'deadParamAliases'
      | 'urlParamAliases'
      | 'deadUrlParam'
      | 'titleParamAliases'
    >
  >;

@Injectable()
export class TemplatesService extends LoggableProvider implements OnModuleInit {
  constructor(
    @RootLogger() rootLogger: Bunyan,
    @InjectBot() private bot: mwn,
    @InjectRepository(Template)
    private templatesRepository: Repository<Template>,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
  ) {
    super(rootLogger);
  }

  async onModuleInit() {
    if (isMainThread) {
      //await this.templatesRepository.delete({});
      await this.create('cite web', {
        titleParam: 'title',
        titleParamAliases: ['заголовок'],
        defaultUrlParam: 'url',
        urlParamAliases: ['url', 'ссылка'],
        archiveUrlParam: 'archive-url',
        archiveUrlParamAliases: ['archive-url', 'archiveurl', 'URL архивной копии'],
        archiveDateParam: 'archive-date',
        archiveDateParamAliases: ['дата архивирования', 'archivedate'],
        deadUrlParam: 'deadlink',
        deadParamAliases: ['мёртвая ссылка', 'deadlink', 'deadurl', 'dead-url'],
      });
    }
  }

  async create(name: string, settings: CreateSettings) {
    const { query } = await this.bot.query({
      action: 'query',
      prop: 'info',
      titles: `Template:${name}`,
    });
    const [page] = query.pages as ApiPage[];

    const template = await this.templatesRepository.save({
      pageId: page.pageid,
      title: extractName(page.title),
      settings: this.settingsRepository.create(settings),
    });

    const aliases = await this.refreshAliases(template.id);

    return { ...template, aliases };
  }

  async findById(templateId: Template['id']) {
    return this.templatesRepository.findOneOrFail(templateId);
  }

  async findAll() {
    return this.templatesRepository.find();
  }

  async refreshAliases(templateId: Template['id']): Promise<ListAliases> {
    const template = await this.findById(templateId);
    const { query } = await this.bot.query({
      action: 'query',
      prop: 'linkshere',
      lhprop: 'pageid|title|redirect',
      lhshow: 'redirect',
      lhnamespace: 10,
      pageids: [template.pageId],
    });
    const aliases = query.pages[0]?.linkshere.map((page) =>
      extractName(page.title),
    );
    await this.templatesRepository.save({ ...template, aliases });
    return aliases;
  }

  // findByName(name: string): CiteTemplate {
  //   return this.data.find((t) => t.name === name.toLowerCase());
  // }
  //
  // isArchived(template: Template): boolean {
  //   const t = this.findByName(template.name as string);
  //   return t.archiveUrlParamAliases.some((param) => template.getParam(param));
  // }
  //
  // isDead(template: Template, content: string): boolean {
  //   const t = this.findByName(template.name as string);
  //   const dead = t.deadLinkParamAliases?.some(
  //     (param) => template.getValue(param) === 'yes',
  //   );
  //   const [, after] = content.split(template.wikitext);
  //   const wkt = new this.bot.wikitext(after);
  //   const [firstTemplate] = wkt.parseTemplates({});
  //   const marked =
  //     !!firstTemplate &&
  //     !!after.match(/^\s+?{{/m) &&
  //     [
  //       'недоступная ссылка',
  //       'мёртвая ссылка',
  //       'битая ссылка',
  //       'deadlink',
  //       'dead link',
  //     ].includes(String(firstTemplate.name).toLowerCase());
  //   return dead || marked;
  // }
  //
  // getUrlValue(template: Template): string {
  //   const t = this.findByName(template.name as string);
  //   return t.urlParamAliases
  //     .map((param) => template.getValue(param))
  //     .find((v) => !!v);
  // }
}
