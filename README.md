# 解析 Swagger 文档成 TypeScript 类型

## 安装

```shell
npm install --save-dev @fk/swagger-ts
```

## 使用

- 项目目录下新建 `swagger-ts.config.js` 文件

- 增加如下代码

```js
// 支持配置多个数据源 [{}, {}, {}]
module.exports = {
  host: 'http://api.com',
  basePath: '/api',
  dist: './src/types',
  resDataKey: 'data', // 非必填, 默认 data
  resPageDataKey: 'records', // 非必填, 默认records
};
```

- 执行并生成文档

``` bash
npx swagger-ts
```

## 配置介绍

- **host**: swagger 文档的接口地址

- **basePath**: 在接口文档的首页查找

- **dist**: 类型文件产出的目录

- **resDataKey**: 接口响应中, 包含业务数据的字段. 用于生成单独的类型.(默认: data, 参考下面的数据结构)

- **resPageDataKey**: 接口响应中, 包含分页数据的字段. 用于生成单独的类型.(默认: records, 参考下面的数据结构)

- **Authorization**: 鉴权登录的 token, 可自行实现(参考./swagger-ts.config 的实现)

- **notRequiredKeys**: 去掉必选

```js
// 接口返回的数据格式
{
  /**
   * 此处的data即为resDataKey
   */
  data: {
    records: []; // 此处的records即为resPageDataKey
    total: number;
    size: number;
    current: number;
  }

  /**
   * 错误编号
   */
  errCode: number;

  /**
   * 错误信息
   */
  errMsg: string;

  /**
   * 是否成功
   */
  success: boolean;
}
```

## 生成的代码结构

- 接口示例

``` js
// 请求参数
{ current: 1, size: 20 }

// 响应数据
{ data: [], errMsg: null, success: true }
```

- 生成的代码

```ts
declare namespace Demo {
  /**
   * 响应数据-data部分
   */
  type ResData = ResBody['data'];

  /**
   * 当data为 T[]类型时, Row 指 T
   * 当data.records为 P[]类型时, Row 指 P
   */
  type Row = ResBody['data'] extends Array<infer O> ? O : never;

  /**
   * 响应数据
   */
  interface ResBody {
    data: T1[];
    errMsg: string;
    success: boolean;
  }

  /**
   * 请求参数
   */
  interface ReqBody {
    current: number;
    size: number;
  }
}

interface T1 {
  name: string;
}
```

- 如何使用

```ts
// service.ts
export async function getDemos(params: Demo.ReqBody): Promise<Demo.ResData> {
  //
}
```
