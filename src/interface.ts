export interface IConfig {
  host: string;
  basePath: string;
  dist: string;
  /**
   * 接口响应中, 包含业务数据的字段. 用于生成单独的类型.
   * @default data
   */
  resDataKey: string;
  /**
   * 接口响应中, 包含分页数据的字段. 用于生成单独的类型.
   * @default records
   */
  resPageDataKey: string;

  /**
   * 登录鉴权token
   */
  Authorization: string;
  /**
   * 去掉必选
   */
  notRequiredKeys:string[];
  
}

export interface ISwagger {
  paths: Record<string, any>;
  tags: { name: string; description: string }[];
  definitions: Record<string, any>;
  basePath: string;
}

export interface IParam {
  in: string;
  description: string;
  name: string;
  required: boolean;
  type: string;
  schema?: {
    $ref: `#/definitions/${string}`;
  };
}
