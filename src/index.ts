import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import { compile } from 'json-schema-to-typescript';
import axios from 'axios';
import prettier from 'prettier';
import { IConfig, IParam, ISwagger } from './interface';
import { toPascal } from './util';

const config: IConfig | IConfig[] = require(`${process.cwd()}/swagger-ts.config.js`);

const fetch = axios.create({});

function getDefinitionName(name?: `#/definitions/${string}`): string {
  if (!name) {
    return '';
  }
  const [, , defName] = name.split('/');
  return defName;
}

function replaceInterfaceName(source: string, name: string) {
  return source.replace(/interface .*? \{/, `interface ${name} {`);
}

function getTagName(tagName: string, tags: { name: string; description: string }[]) {
  const tag = tags.find((o) => o.name === tagName)!;
  if (tag) {
    return tag?.description.split(' ').join('').replace('Controller', '');
  }
  return '';
}

function getNameByUrl(url: string) {
  const paths = url
    .split('/')
    .reverse()
    .filter((p) => {
      return !/^\{.*\}$/.test(p);
    });

  return paths.slice(0, 2).reverse().join('_');
}

async function parameters(data: IParam[], originDefinitions: any, definitions: any,conf:IConfig) {
  if (!data) {
    return [];
  }

  // 根据 in的类型分组
  const results: Record<string, IParam[]> = {};

  data.forEach((d) => {
    if (!results[d.in]) {
      results[d.in] = [];
    }
    results[d.in].push(d);
  });
  // 转换数据格式
  return Promise.all(
    Object.entries(results).map(async ([k, v]) => {
      if (k === 'body' && v.length === 1 && v[0].schema) {
        const defName = getDefinitionName(v[0].schema.$ref);

        const defs = definitions[defName];
        if (defs) {
          return replaceInterfaceName(defs, 'ReqBody').replace(new RegExp(`(${(conf?.notRequiredKeys||[]).join('|')}):`, 'g'), '$1?:');
        }
      }

      const properties: Record<string, { description: string; type?: any; $schema?: any; $ref?: any }> = {};
      const required: string[] = [];

      v.forEach((item) => {
        properties[item.name] = {
          description: item.description,
          type: item.type,
        };
        if (item.required) {
          required.push(item.name);
        }
      });

      return compile(
        {
          title: toPascal(`req_${k}`),
          type: 'object',
          properties,
          required: required.filter((r) => !(conf?.notRequiredKeys||[]).includes(r)),
          definitions: originDefinitions,
        },
        toPascal(`req_${k}`),
        { bannerComment: '', additionalProperties: false }
      );
    })
  );
}

const methods = ['post', 'get', 'put', 'delete', 'patch', 'head', 'options'];

async function handler(url: string, group: string, conf: IConfig) {
  const data: ISwagger = await fetch
    .get(url, {
      headers: {
        Authorization: conf.Authorization,
      },
    })
    .then((res) => res.data)
    .catch((err) => {
      console.log(url, err);
    });

  // 删除错误类型定义
  delete data.definitions['Map«string,List«EnumVo»»'];

  // 增加兼容类型
  data.definitions['List'] = {};

  const definitions: Record<string, string> = {};
  const results: Record<string, string[]> = {};

  await Promise.all(
    Object.entries(data.definitions).map(async ([k, v]) => {
      return compile({ ...v, definitions: data.definitions } as any, k, { bannerComment: '', additionalProperties: false })
        .then((d) => {
          definitions[k] = d;
        })
        .catch((err) => {
          console.log('data.definitions compile err ==>', err);
        });
    })
  );

  await Promise.all(
    Object.entries(data.paths).map(async ([k, v]) => {
      const keys: string[] = [];
      const name = getNameByUrl(k); // 取url的后面两段作为namespace名称

      let tagName = '';
      let author = '';
      let remark = '';

      try {
        await Promise.all(
          methods.map(async (m) => {
            if (!v[m]) {
              return;
            }
            tagName = tagName || getTagName(v[m].tags[0], data.tags);
            author = author || v[m]['x-author'];
            remark = remark || `${v[m].tags[0]} - ${v[m].summary}`;

            // 响应数据处理
            const defName = getDefinitionName(v[m]?.responses['200'].schema?.$ref);

            const defs = definitions[defName];
            if (defs) {
              // 响应数据的可选, 全部替换为必选
              keys.push(replaceInterfaceName(defs.replace(/\?/g, ''), 'ResBody'));
            } else {
              keys.push('export interface ResBody { data: never }');
            }

            // 请求参数处理
            const params = await parameters(v[m].parameters, data.definitions, definitions,conf);

            keys.push(...params);
          })
        );

        const resDataKey = conf.resDataKey || 'data';
        const resPageDataKey = conf.resPageDataKey || 'records';
        // 增加自定义 namespace
        keys.unshift(`
          /**
           * URL: ${data.basePath}${k}
           * 
           * ${remark} ${author || ''}
          */
          declare namespace ${toPascal(name)} {
            type ResData = ResBody['${resDataKey}'];

            type Row = ResBody['${resDataKey}'] extends Array<infer O> ? O : ResData extends { ${resPageDataKey}: Array<infer R> } ? R : never;
        `);
        keys.push('}');
      } catch (error) {
        console.log('处理数据 error: ', error);
      }

      if (keys.length > 2) {
        if (results[tagName]) {
          results[tagName].push(...keys);
        } else {
          results[tagName] = keys;
        }
      }
    })
  );

  Object.keys(results).forEach((key) => {
    const result = results[key];
    /**
     * 格式化处理
     */
    const formatted = prettier.format(result.join('\r\n'), {
      singleQuote: true,
      printWidth: 120,
      tabWidth: 2,
      parser: 'typescript',
      endOfLine: 'crlf',
    });

    const output = path.resolve(process.cwd(), conf.dist, group);

    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true });
    }
    fs.writeFileSync(path.resolve(output, `${key}.d.ts`), formatted);
  });
}

export async function main() {
  const confs: IConfig[] = Array.isArray(config) ? config : [config];

  for (const conf of confs) {
    const data: Array<{ location: string; name: string }> = await fetch
      .get(`${conf.host}${conf.basePath}/swagger-resources`, {
        headers: {
          Authorization: conf.Authorization,
        },
      })
      .then((res) => res.data);

    const bar = new ProgressBar(':token [:bar]', { total: data.length, width: 50, complete: '=', incomplete: ' ' });
    for (const item of data) {
      await handler(`${conf.host}${conf.basePath}${encodeURI(item.location)}`, item.name, conf);
      bar.tick({
        token: item.name,
      });
    }
  }
}
