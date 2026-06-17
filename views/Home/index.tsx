import { Banner, Button, Form, Space, Spin, Toast } from "@douyinfe/semi-ui";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./index.module.css";
import { useTranslation } from "next-i18next";
import { BsSdk } from "@/libs/bs-sdk/BsSdk";
import BProvide from "@/libs/bs-sdk/components/b-provide";
import { BsORM } from "@/libs/bs-sdk/BsORM";
import BSelectField from "@/libs/bs-sdk/components/b-select-field";
import Section from "@douyinfe/semi-ui/lib/es/form/section";
import ECharts from "@/components/echarts";
import {
  base64ToFile,
  downloadFile,
  fileToIOpenAttachment,
  useKeepState,
} from "@/libs/bs-sdk/shared";
import { FieldType } from "@lark-base-open/js-sdk";

const bsSdk = new BsSdk({
  onSelectionChange: true,
  immediatelySelectionChange: true,
});
const orm = new BsORM(bsSdk);

export default function Home() {
  const [t, i18n] = useTranslation();
  const echartRef = useRef<any>();
  const [conf, setConf] = useKeepState<any>({
    output: { type: "preview" },
    chartType: "line",
    chart: { max: 10, min: 0, order: "default", auto: true, showValue: true },
    baseline: { enabled: false, type: "fixed", value: 0, field: "" },
    format: true,
    formatCode: {},
  });
  const [option, setOption] = useState<any>(
    createOption(
      "line",
      { A: 10, B: 0, C: 10 },
      conf?.chart,
      conf?.baseline,
      undefined
    )
  );

  const setConfValue = useCallback(
    (value: any) => {
      conf.select = value.select;
      setConf(Object.assign({}, mergeDeep(conf, value)));
    },
    [conf, setConf]
  );

  const uiConf = () => {
    const map: any = {
      get bar() {
        return (
          <>
            <Form.Select
              field="chart.order"
              label={t("chart-conf-order")}
              placeholder={t("chart-conf-" + conf.chart.order)}
              optionList={[
                { label: t("chart-conf-default"), value: "default" },
                { label: t("chart-conf-asc"), value: "asc" },
                { label: t("chart-conf-desc"), value: "desc" },
              ]}
            ></Form.Select>
          </>
        );
      },
      get line() {
        return (
          <>
            <Form.Select
              field="chart.order"
              label={t("chart-conf-order")}
              placeholder={t("chart-conf-" + conf.chart.order)}
              optionList={[
                { label: t("chart-conf-default"), value: "default" },
                { label: t("chart-conf-asc"), value: "asc" },
                { label: t("chart-conf-desc"), value: "desc" },
              ]}
            ></Form.Select>
            <Form.Switch
              field="chart.showValue"
              label={t("chart-conf-showValue")}
              defaultValue={conf.chart.showValue}
              initValue={conf.chart.showValue}
            ></Form.Switch>
          </>
        );
      },
      get radar() {
        return (
          <>
            <Form.Switch
              field="chart.showValue"
              label={t("chart-conf-showValue")}
              defaultValue={conf.chart.showValue}
              initValue={conf.chart.showValue}
            ></Form.Switch>
            <Form.Switch
              field="chart.auto"
              label={t("chart-conf-auto")}
              defaultValue={conf.chart.auto}
              initValue={conf.chart.auto}
              onChange={(v) => setConfValue({ chart: { auto: v } })}
            ></Form.Switch>
            {!conf.chart?.auto && (
              <>
                <Form.InputNumber
                  field="chart.max"
                  placeholder={conf.chart.max}
                  label={t("chart-conf-max")}
                ></Form.InputNumber>
                <Form.InputNumber
                  field="chart.min"
                  placeholder={conf.chart.min}
                  label={t("chart-conf-min")}
                ></Form.InputNumber>
              </>
            )}
          </>
        );
      },
    };
    return map[conf.chartType] || null;
  };

  useEffect(() => {
    bsSdk.bitable.bridge.getLanguage().then((lang: string) => {
      i18n.changeLanguage(lang.includes("zh") ? "zh" : "en");
    });
  }, []);

  const onSubmit = useCallback(
    async (nconf: any) => {
      conf.select = nconf.select;
      nconf = mergeDeep(conf, nconf);
      if (nconf.chart.isExpr) {
        nconf.chart.expr = nconf.chart.expr || {};
        for (let i = 0; i < nconf.select.length; i++) {
          const fieldId = nconf.select[i];
          if (!nconf.chart.expr[fieldId]) {
            nconf.chart.expr[fieldId] = "x";
          }
        }
      } else {
        nconf.chart.expr = {};
      }
      if (Object.keys(nconf?.select || {}).length === 0)
        return Toast.error(t("toast-select-number-field"));

      let load = Toast.info({
        icon: <Spin />,
        content: `${t("toast-gening")}...`,
        duration: 0,
      });

      let recordId = "";
      if (nconf.output.type !== "multiToField") {
        const select = await bsSdk.getSelection();
        if (select.recordId) {
          recordId = select.recordId as string;
        } else {
          if (nconf?.output?.type === "preview") {
            recordId = await (await bsSdk.getActiveTable())
              .getRecords({ pageSize: 1 })
              .then((res: any) => res.records[0].recordId);
          }
        }
      }

      if (nconf.output.type === "multiToField") {
        const recordIds = await bsSdk.getRecordIds();
        if (!recordIds.length) return Toast.error(t("toast-add-record"));
        for (let i = 0; i < recordIds.length; i++) {
          Toast.close(load);
          load = Toast.info({
            icon: <Spin />,
            content: `${t("toast-gening")}(${i + 1}/${recordIds.length})...`,
            duration: 0,
          });
          const recordId = recordIds[i];
          const url = await gene(recordId);
          if (!url) continue;
          const outfield = orm.getFieldsMap().get(nconf.output.field);
          if ((await outfield?.getType()) !== FieldType.Attachment) {
            Toast.close(load);
            return Toast.error(t("toast-select-field"));
          }
          outfield?.setValue(recordId, [
            await fileToIOpenAttachment(
              bsSdk.base,
              base64ToFile(url, Date.now() + ".png", "image/png")
            ),
          ]);
        }
      } else if (nconf.output.type === "toField") {
        if (!recordId) {
          Toast.close(load);
          return Toast.error(t("toast-select-record"));
        }
        const url = await gene(recordId);
        const outfield = orm.getFieldsMap().get(nconf.output.field);
        if ((await outfield?.getType()) !== FieldType.Attachment) {
          Toast.close(load);
          return Toast.error(t("toast-select-field"));
        }
        outfield?.setValue(recordId, [
          await fileToIOpenAttachment(
            bsSdk.base,
            base64ToFile(url, Date.now() + ".png", "image/png")
          ),
        ]);
      } else {
        if (!recordId) {
          Toast.close(load);
          return Toast.error(t("toast-select-record"));
        }
        await gene(recordId);
      }
      Toast.close(load);
      Toast.success(t("toast-gene-success"));

      async function gene(recordId: string) {
        const record = await orm.getRecord(recordId);
        const selectFieldRecord = nconf.select.reduce(
          (map: any, fieldId: string) => {
            let v = toDisplay(record[fieldId]);
            if (!v) v = 0;
            v = Number(v);
            if (typeof v === "number" && v === v) {
              map[orm.getFieldsMap()?.get(fieldId)?.name as string] = nconf
                .chart?.expr?.[fieldId]
                ? parseExpr(nconf.chart.expr[fieldId], { x: v }, () => v)
                : v;
            }
            return map;
          },
          {}
        );
        if (Object.keys(selectFieldRecord).length === 0) return;

        // 计算基准线值
        let baselineValue: number | undefined;
        if (nconf.baseline?.enabled) {
          if (nconf.baseline.type === "fixed") {
            baselineValue = Number(nconf.baseline.value) || 0;
          } else if (nconf.baseline.type === "field" && nconf.baseline.field) {
            const bv = toDisplay(record[nconf.baseline.field]);
            baselineValue = Number(bv) || 0;
          }
        }

        setOption(
          createOption(
            nconf.chartType,
            selectFieldRecord,
            nconf?.chart,
            nconf?.baseline,
            baselineValue,
            toDisplay(record[nconf.selectLabel])
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 1));
        const url = (echartRef.current as any)?.getDataURL();
        return url;
      }
    },
    [conf, t]
  );

  const onChange = useCallback(
    (e: any) => {
      setConfValue(e.values);
    },
    [setConfValue]
  );

  function createOption(
    chartType: string,
    data: any,
    opt: any = {},
    baselineConf: any = {},
    baselineValue?: number,
    label?: any
  ) {
    let keys = Object.keys(data);
    const maxKeyLen = Math.max(...keys.map((key) => key.length));
    if (opt.order === "asc" || opt.order === "desc") {
      keys = extractAndSortNumbers(keys);
      if (opt.order === "desc") keys = keys.reverse();
    }
    if (opt.auto && keys.length) {
      opt.max = Math.max(...keys.map((key) => data[key]));
      opt.min = 0;
    }

    const values = keys.map((key) => data[key]);

    return (
      (
        {
          get line() {
            const seriesData = keys.map((key) => data[key]);
            const markLineData: any[] = [];
            if (baselineConf?.enabled && baselineValue !== undefined) {
              markLineData.push({
                yAxis: baselineValue,
                name: "基准线",
                label: {
                  formatter: "基准: {c}",
                  position: "insideEndTop",
                },
                lineStyle: {
                  color: "#ff4d4f",
                  type: "dashed",
                  width: 2,
                },
              });
            }

            return {
              wrapStyle: {
                width: `${(keys.length ?? 0) * 100 + 100}px`,
                height: `500px`,
              },
              animation: false,
              tooltip: {
                trigger: "axis",
              },
              xAxis: {
                type: "category",
                data: keys,
              },
              yAxis: {
                type: "value",
              },
              series: [
                {
                  data: seriesData,
                  type: "line",
                  label: {
                    show: opt.showValue !== false,
                    position: "top",
                    formatter: "{c}",
                  },
                  markLine:
                    markLineData.length > 0
                      ? {
                          data: markLineData,
                          symbol: ["none", "none"],
                        }
                      : undefined,
                },
              ],
            };
          },
          get bar() {
            return {
              wrapStyle: {
                width: `${(keys.length ?? 0) * 100 + 100}px`,
                height: `500px`,
              },
              animation: false,
              xAxis: {
                type: "category",
                data: keys,
              },
              yAxis: {
                type: "value",
              },
              series: [
                {
                  data: keys.map((key) => data[key]),
                  type: "bar",
                },
              ],
            };
          },
          get radar() {
            const maxVal = Math.max(...keys.map((key) => data[key]));
            return {
              wrapStyle: {
                width: `500px`,
                height: `500px`,
              },
              backgroundColor: "#fff",
              animation: false,
              legend: {},
              textStyle: {
                fontSize: 16,
              },
              radar: {
                indicator: keys.map((key) => ({
                  name: key,
                  max: data[key] > opt.max ? data[key] : opt.max,
                  min: opt.min,
                  color: data[key] > opt.max ? "red" : undefined,
                })),
                axisName: {
                  color: "#5470c6",
                },
                center: ["50%", "50%"],
                radius:
                  maxKeyLen > 5 ? "50%" : maxKeyLen > 4 ? "60%" : "70%",
              },
              series: [
                {
                  name: "Budget vs spending",
                  type: "radar",
                  data: [
                    {
                      value: keys.map((key) => data[key]),
                      areaStyle: {
                        color: "rgba(66, 139, 212, 0.3)",
                      },
                      label: {
                        show: opt.showValue,
                        position: "inside",
                      },
                      name: label,
                    },
                  ],
                },
              ],
            };
          },
        } as any
      )[chartType] || {}
    );
  }

  return (
    <main className={styles.main}>
      <BProvide
        orm={orm}
        formProps={{
          onSubmit,
          onChange,
          labelPosition: "left",
          initValues: conf,
        }}
        loadingText={t("init")}
      >
        <Section text={t("field-conf")} style={{ marginTop: "10px" }}>
          <BSelectField
            field="select"
            label={t("select-field")}
            placeholder={t("select-field-tip")}
            multiple
          ></BSelectField>
          <BSelectField
            field="selectLabel"
            label={t("label-field")}
            placeholder={t("select-field-any-tip")}
            filterOption={(field: any) => field?.type !== FieldType.Number}
            otherOptions={[
              {
                id: "none",
                name: "不显示",
              },
            ]}
          ></BSelectField>
        </Section>

        <Section text={t("chart-conf")} style={{ marginTop: "10px" }}>
          <Form.Select
            field="chartType"
            label={t("chart-conf-type")}
            optionList={[
              { label: t("chart-conf-line"), value: "line" },
              { label: t("chart-conf-bar"), value: "bar" },
              { label: t("chart-conf-radar"), value: "radar" },
            ]}
            onChange={(v: any) => {
              setConfValue({ chartType: v });
            }}
          ></Form.Select>
          <Form.Switch
            field="chart.isExpr"
            label={t("chart-conf-expr")}
            defaultValue={conf.chart.isExpr}
            initValue={conf.chart.isExpr}
            onChange={(v) => setConfValue({ chart: { isExpr: v } })}
          ></Form.Switch>
          {conf.chart?.isExpr &&
            conf.select?.map((fieldId: string) => (
              <Form.Input
                key={fieldId}
                field={`chart.expr.${fieldId}`}
                label={orm.getFieldsMap()?.get(fieldId)?.name}
                placeholder="x"
              ></Form.Input>
            ))}
          {uiConf()}
        </Section>

        {/* 新增：基准线配置 */}
        <Section text={"基准线配置"} style={{ marginTop: "10px" }}>
          <Form.Switch
            field="baseline.enabled"
            label={"启用基准线"}
            defaultValue={conf.baseline.enabled}
            initValue={conf.baseline.enabled}
            onChange={(v) => setConfValue({ baseline: { enabled: v } })}
          ></Form.Switch>
          {conf.baseline?.enabled && (
            <>
              <Form.RadioGroup
                field="baseline.type"
                label={"基准线来源"}
                type="button"
                defaultValue={conf.baseline.type}
                initValue={conf.baseline.type}
                onChange={(v) => setConfValue({ baseline: { type: v } })}
              >
                <Form.Radio value="fixed">固定数值</Form.Radio>
                <Form.Radio value="field">数据表字段</Form.Radio>
              </Form.RadioGroup>
              {conf.baseline?.type === "fixed" ? (
                <Form.InputNumber
                  field="baseline.value"
                  label={"基准值"}
                  placeholder="请输入预期数值"
                  defaultValue={conf.baseline.value}
                  initValue={conf.baseline.value}
                ></Form.InputNumber>
              ) : (
                <BSelectField
                  field="baseline.field"
                  label={"基准字段"}
                  placeholder={"请选择包含预期值的字段"}
                  filterOption={(field: any) => field?.type === FieldType.Number}
                ></BSelectField>
              )}
            </>
          )}
        </Section>

        <Section text={t("output-conf")} style={{ marginTop: "10px" }}>
          <Form.Select field="output.type" label={t("output-type")}>
            <Form.Select.Option value={"preview"}>
              {t("priview")}
            </Form.Select.Option>
            <Form.Select.Option value={"toField"}>
              {t("gene-to-field")}
            </Form.Select.Option>
            <Form.Select.Option value={"multiToField"}>
              {t("gene-multi-to-field")}
            </Form.Select.Option>
          </Form.Select>
          {conf?.output && conf?.output?.type !== "preview" && (
            <>
              <BSelectField
                field="output.field"
                filterOption={(field: any) => field?.type === FieldType.Attachment}
                label={t("output-field")}
                placeholder={t("output-field-tip")}
              ></BSelectField>
              <Banner
                type="danger"
                description={t("output-field-danger")}
                style={{ marginBottom: "10px" }}
              />
            </>
          )}
        </Section>

        <Space>
          <Button htmlType="submit" block type="primary">
            {t("btn-gene")}
          </Button>
          <Button
            type="secondary"
            block
            onClick={() => open("https://zhuanlan.zhihu.com/p/669107200")}
          >
            {t("btn-help")}
          </Button>
        </Space>

        <div style={{ width: "100%", overflow: "scroll" }}>
          <div style={option.wrapStyle}>
            <ECharts refInstance={echartRef} option={option}></ECharts>
          </div>
        </div>
      </BProvide>
    </main>
  );
}

function toDisplay(cell: any) {
  return typeof cell === "object"
    ? cell?.text ??
        cell
          ?.map?.((item: any) => item?.text ?? item?.name)
          .filter((item: any) => item)
          .join(",")
    : cell;
}

function extractAndSortNumbers(strings: any[]) {
  const chineseNumberMap: any = {
    零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
    六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
    百: 100, 千: 1000, 万: 10000, 亿: 100000000,
  };
  function chineseToNumber(chineseStr: string) {
    let total = 0, temp = 0, prevUnit = 1;
    for (const char of chineseStr.split("")) {
      let value = chineseNumberMap[char];
      if (value < 10) temp = value;
      else {
        if (temp === 0) temp = 1;
        if (value > prevUnit) {
          total += temp;
          total *= value;
          temp = 0;
        } else {
          total += temp * value;
        }
        prevUnit = value;
        temp = 0;
      }
    }
    return total + temp;
  }
  function extractNumber(str: string) {
    const numberPattern = /(\d+|[零一二三四五六七八九十百千万亿]+)/g;
    const matches = str.match(numberPattern);
    if (!matches) return 0;
    return matches.reduce((sum: number, match: string) => {
      return sum + (isNaN(Number(match)) ? chineseToNumber(match) : Number(match));
    }, 0);
  }
  function sortWithNumbers(a: any, b: any) {
    return extractNumber(a) - extractNumber(b);
  }
  return strings.slice().sort(sortWithNumbers);
}

function mergeDeep(a: any, b: any) {
  const keys = Object.keys(b);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof b[key] === "object") {
      if (typeof a[key] === "object") mergeDeep(a[key], b[key]);
      else a[key] = b[key];
    } else {
      a[key] = b[key];
    }
  }
  return a;
}

function parseExpr(expr: string, ctx: any, cb: any) {
  try {
    return new Function("ctx", `with(ctx){return ${expr}}`)(ctx);
  } catch (error) {
    return cb();
  }
}
