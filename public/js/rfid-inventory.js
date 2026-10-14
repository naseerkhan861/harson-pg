document.addEventListener(
  "DOMContentLoaded",
  () => {

    /* =====================================================
       DOM
       ===================================================== */

    const importButton =
      document.getElementById(
        "importInventoryBtn"
      );

    const connectButton =
      document.getElementById(
        "connectDeviceBtn"
      );

    const finishButton =
      document.getElementById(
        "finishInventoryBtn"
      );

    const resetButton =
      document.getElementById(
        "resetInventoryBtn"
      );

    const fileInput =
      document.getElementById(
        "inventoryFileInput"
      );

    const inventoryStatus =
      document.getElementById(
        "inventoryStatus"
      );

    const deviceStatus =
      document.getElementById(
        "deviceStatus"
      );

    const sessionStatus =
      document.getElementById(
        "sessionStatus"
      );

    const liveStateText =
      document.getElementById(
        "liveStateText"
      );

    const logStatus =
      document.getElementById(
        "logStatus"
      );

    const tableBody =
      document.getElementById(
        "inventoryTableBody"
      );

    const recordCount =
      document.getElementById(
        "recordCount"
      );


    /* =====================================================
       Summary
       ===================================================== */

    const summaryExpected =
      document.getElementById(
        "summaryExpected"
      );

    const summaryScanned =
      document.getElementById(
        "summaryScanned"
      );

    const summaryMatched =
      document.getElementById(
        "summaryMatched"
      );

    const summaryPending =
      document.getElementById(
        "summaryPending"
      );

    const summaryExtra =
      document.getElementById(
        "summaryExtra"
      );

    const summaryRate =
      document.getElementById(
        "summaryRate"
      );


    /* =====================================================
       State
       ===================================================== */

    let inventoryRecords = [];

    let scannedTags =
      new Map();

    let inventoryFinished =
      false;


    /* =====================================================
       Helpers
       ===================================================== */

    function normalizeText(value) {

      return String(
        value ?? ""
      )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "")
        .replace(/-/g, "");
    }


    function normalizeEpc(value) {

      return String(
        value ?? ""
      )
        .trim()
        .replace(/\s+/g, "")
        .toUpperCase();
    }


    function escapeHtml(value) {

      return String(
        value ?? ""
      )
        .replaceAll(
          "&",
          "&amp;"
        )
        .replaceAll(
          "<",
          "&lt;"
        )
        .replaceAll(
          ">",
          "&gt;"
        )
        .replaceAll(
          '"',
          "&quot;"
        )
        .replaceAll(
          "'",
          "&#039;"
        );
    }


    function getTime() {

      return new Date()
        .toLocaleTimeString(
          "zh-CN",
          {
            hour12: false
          }
        );
    }


    function addLog(
      type,
      message
    ) {

      const log =
        document.getElementById(
          "systemLog"
        );

      if (!log) {
        return;
      }


      const row =
        document.createElement(
          "div"
        );

      row.className =
        "rfid-log-line";


      row.innerHTML = `
        <span class="rfid-log-time">
          ${getTime()}
        </span>

        <span class="rfid-log-type">
          ${escapeHtml(type)}
        </span>

        <span>
          ${escapeHtml(message)}
        </span>
      `;


      log.appendChild(
        row
      );

      log.scrollTop =
        log.scrollHeight;
    }


    /* =====================================================
       Excel header aliases
       ===================================================== */

    const aliases = {

      epc: [
        "epc",
        "epc编码",
        "标签epc",
        "rfidepc",
        "rfid编码",
        "标签编码"
      ],

      sku: [
        "sku",
        "商品sku",
        "货号",
        "商品编码"
      ],

      name: [
        "商品名称",
        "名称",
        "品名",
        "商品"
      ],

      spec: [
        "规格/颜色",
        "规格",
        "颜色",
        "尺码"
      ],

      quantity: [
        "应有数量",
        "库存数量",
        "数量"
      ],

      remark: [
        "备注",
        "说明"
      ]
    };


    function matchesAlias(
      value,
      aliasList
    ) {

      const normalized =
        normalizeText(
          value
        );


      return aliasList.some(
        alias =>
          normalizeText(alias)
          ===
          normalized
      );
    }


    function findColumnIndex(
      headerRow,
      aliasList
    ) {

      return headerRow.findIndex(
        cell =>
          matchesAlias(
            cell,
            aliasList
          )
      );
    }


    /* =====================================================
       Excel parser
       ===================================================== */

    async function parseInventoryExcel(
      file
    ) {

      if (
        typeof XLSX
        ===
        "undefined"
      ) {

        throw new Error(
          "Excel 解析组件加载失败，请刷新页面后重试"
        );
      }


      const buffer =
        await file.arrayBuffer();


      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array"
          }
        );


      if (
        !workbook.SheetNames.length
      ) {

        throw new Error(
          "Excel 中没有可读取的工作表"
        );
      }


      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];


      const rows =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            header: 1,
            defval: "",
            raw: false
          }
        );


      if (!rows.length) {

        throw new Error(
          "Excel 内容为空"
        );
      }


      /* -----------------------------------------------
         Find header row
         最多检查前 30 行
         ----------------------------------------------- */

      let headerIndex = -1;


      const searchLimit =
        Math.min(
          rows.length,
          30
        );


      for (
        let rowIndex = 0;
        rowIndex < searchLimit;
        rowIndex++
      ) {

        const row =
          rows[rowIndex];


        const containsEpc =
          row.some(
            cell =>
              matchesAlias(
                cell,
                aliases.epc
              )
          );


        if (containsEpc) {

          headerIndex =
            rowIndex;

          break;
        }
      }


      if (
        headerIndex === -1
      ) {

        throw new Error(
          "没有找到 EPC 列，请确认 Excel 中包含 EPC 编码字段"
        );
      }


      const headers =
        rows[headerIndex];


      const epcIndex =
        findColumnIndex(
          headers,
          aliases.epc
        );

      const skuIndex =
        findColumnIndex(
          headers,
          aliases.sku
        );

      const nameIndex =
        findColumnIndex(
          headers,
          aliases.name
        );

      const specIndex =
        findColumnIndex(
          headers,
          aliases.spec
        );

      const quantityIndex =
        findColumnIndex(
          headers,
          aliases.quantity
        );

      const remarkIndex =
        findColumnIndex(
          headers,
          aliases.remark
        );


      /* -----------------------------------------------
         Build records
         ----------------------------------------------- */

      const records = [];

      const epcSet =
        new Set();


      for (
        let rowIndex =
          headerIndex + 1;

        rowIndex <
          rows.length;

        rowIndex++
      ) {

        const row =
          rows[rowIndex];


        const epc =
          normalizeEpc(
            row[epcIndex]
          );


        if (!epc) {
          continue;
        }


        /* duplicate EPC */

        if (
          epcSet.has(epc)
        ) {

          continue;
        }


        epcSet.add(
          epc
        );


        const record = {

          epc,

          sku:
            skuIndex >= 0
              ? String(
                  row[skuIndex]
                  ?? ""
                ).trim()
              : "",

          name:
            nameIndex >= 0
              ? String(
                  row[nameIndex]
                  ?? ""
                ).trim()
              : "",

          spec:
            specIndex >= 0
              ? String(
                  row[specIndex]
                  ?? ""
                ).trim()
              : "",

          quantity:
            quantityIndex >= 0
              ? String(
                  row[quantityIndex]
                  ?? ""
                ).trim()
              : "",

          remark:
            remarkIndex >= 0
              ? String(
                  row[remarkIndex]
                  ?? ""
                ).trim()
              : ""
        };


        records.push(
          record
        );
      }


      if (!records.length) {

        throw new Error(
          "Excel 中没有找到有效的 EPC 数据"
        );
      }


      return records;
    }


    /* =====================================================
       Summary
       ===================================================== */

    function updateSummary() {

      const expected =
        inventoryRecords.length;


      const scanned =
        scannedTags.size;


      let matched =
        0;


      let extra =
        0;


      const expectedSet =
        new Set(
          inventoryRecords.map(
            item =>
              item.epc
          )
        );


      scannedTags.forEach(
        (
          value,
          epc
        ) => {

          if (
            expectedSet.has(epc)
          ) {

            matched++;

          } else {

            extra++;
          }
        }
      );


      const pending =
        Math.max(
          expected - matched,
          0
        );


      const rate =
        expected > 0
          ? (
              matched /
              expected
              *
              100
            )
          : 0;


      summaryExpected.textContent =
        expected;


      summaryScanned.textContent =
        scanned;


      summaryMatched.textContent =
        matched;


      summaryPending.textContent =
        pending;


      summaryExtra.textContent =
        extra;


      summaryRate.textContent =
        `${rate.toFixed(1)}%`;


      /* -----------------------------------------------
         只有真正出现状态时才着色
         ----------------------------------------------- */

      summaryMatched.classList.toggle(
        "rfid-number-success",
        matched > 0
      );


      summaryPending.classList.toggle(
        "rfid-number-warning",
        pending > 0
        &&
        expected > 0
      );


      summaryExtra.classList.toggle(
        "rfid-number-extra",
        extra > 0
      );
    }


    /* =====================================================
       Table render
       ===================================================== */

    function renderInventoryTable() {

      if (
        !inventoryRecords.length
        &&
        !scannedTags.size
      ) {

        tableBody.innerHTML = `
          <tr class="rfid-empty-row">
            <td colspan="9">

              <div class="rfid-empty-state">

                <div class="rfid-empty-symbol">
                  RFID
                </div>

                <strong>
                  暂无盘点数据
                </strong>

                <span>
                  导入库存并连接扫描设备后开始盘点
                </span>

              </div>

            </td>
          </tr>
        `;


        recordCount.textContent =
          "0 条记录";


        return;
      }


      const resultMap =
        new Map();


      /* -----------------------------------------------
         Expected inventory
         ----------------------------------------------- */

      inventoryRecords.forEach(
        record => {

          resultMap.set(
            record.epc,
            {
              ...record,

              inventoryExists:
                true,

              scanned:
                scannedTags.get(
                  record.epc
                )
                ||
                null
            }
          );
        }
      );


      /* -----------------------------------------------
         Extra scanned EPC
         ----------------------------------------------- */

      scannedTags.forEach(
        (
          scan,
          epc
        ) => {

          if (
            resultMap.has(epc)
          ) {
            return;
          }


          resultMap.set(
            epc,
            {
              epc,

              sku: "",
              name: "",
              spec: "",
              quantity: "",
              remark: "",

              inventoryExists:
                false,

              scanned:
                scan
            }
          );
        }
      );


      const results =
        Array.from(
          resultMap.values()
        );


      recordCount.textContent =
        `${results.length} 条记录`;


      tableBody.innerHTML =
        results
          .map(
            (
              row,
              index
            ) => {

              const scanned =
                Boolean(
                  row.scanned
                );


              let status =
                "待扫描";


              let statusClass =
                "status-pending";


              if (
                row.inventoryExists
                &&
                scanned
              ) {

                status =
                  "正常";

                statusClass =
                  "status-normal";

              } else if (
                !row.inventoryExists
                &&
                scanned
              ) {

                status =
                  "多出";

                statusClass =
                  "status-extra";

              } else if (
                inventoryFinished
                &&
                row.inventoryExists
                &&
                !scanned
              ) {

                status =
                  "缺失";

                statusClass =
                  "status-missing";
              }


              return `
                <tr>

                  <td>
                    ${String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </td>

                  <td
                    title="${escapeHtml(row.epc)}"
                  >
                    ${escapeHtml(row.epc)}
                  </td>

                  <td>
                    ${escapeHtml(
                      row.sku
                      || "—"
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      row.name
                      || "—"
                    )}
                  </td>

                  <td>
                    ${
                      row.inventoryExists
                        ? "✓"
                        : "—"
                    }
                  </td>

                  <td>
                    ${
                      scanned
                        ? "✓"
                        : "—"
                    }
                  </td>

                  <td>
                    ${escapeHtml(
                      row.scanned?.rssi
                      || "—"
                    )}
                  </td>

                  <td>
                    ${
                      row.scanned?.count
                      || 0
                    }
                  </td>

                  <td
                    class="${statusClass}"
                  >
                    ${status}
                  </td>

                </tr>
              `;
            }
          )
          .join("");
    }


    function refreshUI() {

      updateSummary();

      renderInventoryTable();
    }


    /* =====================================================
       Import inventory
       ===================================================== */

    importButton?.addEventListener(
      "click",
      () => {

        fileInput.value =
          "";

        fileInput.click();
      }
    );


    fileInput?.addEventListener(
      "change",
      async () => {

        const file =
          fileInput.files?.[0];


        if (!file) {
          return;
        }


        try {

          importButton.disabled =
            true;


          sessionStatus.textContent =
            "正在读取库存";


          logStatus.textContent =
            "正在导入";


          addLog(
            "库存",
            `正在读取：${file.name}`
          );


          const records =
            await parseInventoryExcel(
              file
            );


          inventoryRecords =
            records;


          scannedTags =
            new Map();


          inventoryFinished =
            false;


          inventoryStatus.textContent =
            `${file.name} · ${records.length} EPC`;


          sessionStatus.textContent =
            "等待扫描设备";


          logStatus.textContent =
            "库存已导入";


          finishButton.disabled =
            false;


          resetButton.disabled =
            false;


          addLog(
            "库存",
            `库存导入完成，共 ${records.length} 个唯一 EPC`
          );


          refreshUI();


        } catch (error) {

          console.error(
            error
          );


          sessionStatus.textContent =
            "库存导入失败";


          logStatus.textContent =
            "导入失败";


          addLog(
            "错误",
            error.message
            ||
            "库存导入失败"
          );


          window.alert(
            error.message
            ||
            "库存导入失败"
          );


        } finally {

          importButton.disabled =
            false;
        }
      }
    );


    /* =====================================================
       Connect device
       目前只准备 UI 状态
       ===================================================== */

    connectButton?.addEventListener(
      "click",
      () => {

        deviceStatus.textContent =
          "C72 · 等待接入";


        sessionStatus.textContent =
          inventoryRecords.length
            ? "等待扫描设备"
            : "请先导入库存";


        liveStateText.textContent =
          "等待设备上线";


        logStatus.textContent =
          "等待设备";


        addLog(
          "设备",
          "已进入扫描设备等待状态"
        );
      }
    );


    /* =====================================================
       Finish inventory
       ===================================================== */

    finishButton?.addEventListener(
      "click",
      () => {

        if (
          !inventoryRecords.length
        ) {

          return;
        }


        inventoryFinished =
          true;


        sessionStatus.textContent =
          "盘点已结束";


        logStatus.textContent =
          "盘点已结束";


        addLog(
          "盘点",
          "盘点结束，未扫描库存已标记为缺失"
        );


        renderInventoryTable();

        updateSummary();
      }
    );


    /* =====================================================
       Reset inventory
       ===================================================== */

    resetButton?.addEventListener(
      "click",
      () => {

        if (
          !inventoryRecords.length
        ) {
          return;
        }


        const confirmed =
          window.confirm(
            "是否清空当前扫描结果并重新开始盘点？"
          );


        if (!confirmed) {
          return;
        }


        scannedTags =
          new Map();


        inventoryFinished =
          false;


        sessionStatus.textContent =
          "等待扫描设备";


        logStatus.textContent =
          "等待操作";


        addLog(
          "盘点",
          "已清空扫描结果，开始新一轮盘点"
        );


        refreshUI();
      }
    );


    /* =====================================================
       Initial
       ===================================================== */

    refreshUI();

  }
);