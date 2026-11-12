<template>
  <div class="bf-page">
    <PageHeader title="设备资产" :subtitle="`${db.devices.length} 台设备 · 校准有效期、使用记录与维修记录统一管理`">
      <template #actions>
        <el-button size="small" @click="exportCsv"><Download :size="14" /> 导出</el-button>
        <el-button v-if="app.can('create')" size="small" type="primary" @click="openCreate"><Plus :size="14" /> 新增设备</el-button>
      </template>
    </PageHeader>

    <div v-if="alerts.length" class="alerts">
      <div v-for="alert in alerts" :key="alert.device.id" class="alert" :class="alert.state">
        <AlertTriangle :size="14" />
        <span>
          <b>{{ alert.device.code }} {{ alert.device.name }}</b>
          {{ alert.state === 'expired' ? `校准已过期 ${Math.abs(alert.days)} 天` : `校准将在 ${alert.days} 天后到期` }}
          （到期 {{ alert.device.calibrationDue }}）
        </span>
        <el-button v-if="app.can('edit')" size="small" text @click="openEdit(alert.device)">处理</el-button>
      </div>
    </div>

    <section class="bf-panel">
      <div class="bf-toolbar">
        <el-input v-model="keyword" placeholder="搜索设备编号 / 名称 / 型号 / 序列号" clearable style="width: 280px">
          <template #prefix><Search :size="14" /></template>
        </el-input>
        <el-select v-model="categoryFilter" placeholder="设备分类" clearable style="width: 140px">
          <el-option v-for="(row, key) in deviceCategory.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px">
          <el-option v-for="(row, key) in deviceStatus.map" :key="key" :label="row.label" :value="key" />
        </el-select>
        <el-button text @click="resetFilters">重置</el-button>
        <span class="grow" />
        <span class="bf-filter-count">可用 {{ availableCount }} 台 · 校准异常 {{ alerts.length }} 台</span>
      </div>

      <el-table :data="paged" size="small" @sort-change="onSortChange">
        <el-table-column prop="code" label="编号" width="92" sortable="custom">
          <template #default="{ row }"><span class="bf-table-code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column label="设备" min-width="210">
          <template #default="{ row }">
            <button class="device-link" type="button" @click="openDrawer(row)">{{ row.name }}</button>
            <div class="bf-sub">{{ row.model }} · SN {{ row.serial }}</div>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            <StatusPill :label="deviceCategory.get(row.category).label" :tone="deviceCategory.get(row.category).tone" />
          </template>
        </el-table-column>
        <el-table-column prop="station" label="工位" width="140" />
        <el-table-column label="负责人" width="88">
          <template #default="{ row }">{{ memberName(row.ownerId) }}</template>
        </el-table-column>
        <el-table-column label="校准有效期" width="140" sortable="custom" prop="calibrationDue">
          <template #default="{ row }">
            <div class="cal" :class="calibrationState(row).state">
              <span>{{ row.calibrationDue }}</span>
              <span class="bf-sub">{{ calibrationState(row).label }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="86">
          <template #default="{ row }">
            <StatusPill :label="deviceStatus.get(row.status).label" :tone="deviceStatus.get(row.status).tone" />
          </template>
        </el-table-column>
        <el-table-column label="使用记录" width="86" align="right">
          <template #default="{ row }">{{ deviceService.usageCount(row.id) }} 次</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="openDrawer(row)">详情</el-button>
            <el-button v-if="app.can('edit')" size="small" text @click="openEdit(row)">编辑</el-button>
            <el-button v-if="app.can('delete')" size="small" text type="danger" @click="removeDevice(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <DataPager v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </section>

    <el-drawer v-model="drawerOpen" :title="active ? `${active.code} · ${active.name}` : ''" size="520px">
      <template v-if="active">
        <div class="device-top">
          <div>
            <StatusPill :label="deviceCategory.get(active.category).label" :tone="deviceCategory.get(active.category).tone" />
            <StatusPill :label="deviceStatus.get(active.status).label" :tone="deviceStatus.get(active.status).tone" style="margin-left: 6px" />
            <p class="bf-sub">{{ active.vendor }} · {{ active.model }} · SN {{ active.serial }}</p>
          </div>
          <div class="qr">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="设备二维码" />
            <span v-else class="bf-sub">二维码生成中</span>
            <span class="bf-sub">扫码报修 / 查看设备</span>
          </div>
        </div>

        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="工位">{{ active.station }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ memberName(active.ownerId) }}</el-descriptions-item>
          <el-descriptions-item label="校准日期">{{ active.calibrationDate }}</el-descriptions-item>
          <el-descriptions-item label="校准到期">{{ active.calibrationDue }}</el-descriptions-item>
          <el-descriptions-item label="关联执行" :span="2">{{ deviceService.usageCount(active.id) }} 次</el-descriptions-item>
        </el-descriptions>

        <h4 class="block-title">使用记录</h4>
        <div class="usage-list">
          <div v-for="(usage, idx) in active.usage" :key="idx" class="usage">
            <span class="mono">{{ usage.at.slice(0, 10) }}</span>
            <span>{{ memberName(usage.by) }} · {{ usage.note }}</span>
            <router-link v-if="usage.executionId" :to="`/test-executions/${usage.executionId}`" class="mono link">{{ usage.executionId }}</router-link>
          </div>
          <EmptyState v-if="active.usage.length === 0" text="暂无使用记录" />
        </div>

        <h4 class="block-title">维修记录</h4>
        <div class="usage-list">
          <div v-for="(repair, idx) in active.repairs" :key="idx" class="usage">
            <span class="mono">{{ repair.at.slice(0, 10) }}</span>
            <span>{{ repair.note }}</span>
            <span v-if="repair.cost" class="bf-sub">¥{{ repair.cost }}</span>
          </div>
          <EmptyState v-if="active.repairs.length === 0" text="暂无维修记录" />
        </div>

        <div class="drawer-actions">
          <el-button size="small" @click="repairDialog = true">登记维修</el-button>
          <el-button size="small" @click="openEdit(active)">编辑设备</el-button>
        </div>
      </template>
    </el-drawer>

    <el-dialog v-model="dialogOpen" :title="editing ? '编辑设备' : '新增设备'" width="680px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <div class="form-grid">
          <el-form-item label="设备名称" prop="name"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="设备分类" prop="category">
            <el-select v-model="form.category" style="width: 100%">
              <el-option v-for="(row, key) in deviceCategory.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="型号" prop="model"><el-input v-model="form.model" /></el-form-item>
          <el-form-item label="序列号" prop="serial"><el-input v-model="form.serial" /></el-form-item>
          <el-form-item label="厂商"><el-input v-model="form.vendor" /></el-form-item>
          <el-form-item label="工位"><el-input v-model="form.station" /></el-form-item>
          <el-form-item label="负责人" prop="ownerId">
            <el-select v-model="form.ownerId" style="width: 100%">
              <el-option v-for="member in db.members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option v-for="(row, key) in deviceStatus.map" :key="key" :label="row.label" :value="key" />
            </el-select>
          </el-form-item>
          <el-form-item label="校准日期" prop="calibrationDate">
            <el-date-picker v-model="form.calibrationDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="校准到期" prop="calibrationDue">
            <el-date-picker v-model="form.calibrationDue" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="repairDialog" title="登记维修记录" width="460px">
      <el-form label-width="76px">
        <el-form-item label="维修说明"><el-input v-model="repairNote" type="textarea" :rows="3" placeholder="故障现象、处理方式" /></el-form-item>
        <el-form-item label="费用"><el-input-number v-model="repairCost" :min="0" :controls="false" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="repairDialog = false">取消</el-button>
        <el-button type="primary" @click="saveRepair">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import QRCode from 'qrcode'
import { AlertTriangle, Download, Plus, Search } from 'lucide-vue-next'
import type { Attachment, Device, DeviceCategory, DeviceStatus } from '@/types'
import { db } from '@/services/db'
import { deviceService } from '@/services/assetService'
import type { DeviceInput } from '@/services/assetService'
import { useAppStore } from '@/stores/app'
import { useTable } from '@/composables/useTable'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DataPager from '@/components/common/DataPager.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { deviceCategory, deviceStatus } from '@/utils/format'
import { downloadText, toCsv } from '@/utils/csv'

const app = useAppStore()

const keyword = ref('')
const categoryFilter = ref<DeviceCategory | ''>('')
const statusFilter = ref<DeviceStatus | ''>('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return db.devices.filter((row) => {
    if (categoryFilter.value && row.category !== categoryFilter.value) return false
    if (statusFilter.value && row.status !== statusFilter.value) return false
    if (kw && !`${row.code} ${row.name} ${row.model} ${row.serial} ${row.vendor}`.toLowerCase().includes(kw)) return false
    return true
  })
})

const accessors = {
  code: (row: Device) => row.code,
  calibrationDue: (row: Device) => row.calibrationDue,
}

const { page, pageSize, total, paged, onSortChange } = useTable(filtered, { pageSize: 10, accessors })

const alerts = computed(() => deviceService.alerts())
const availableCount = computed(() => db.devices.filter((d) => d.status === 'available').length)
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id

const calibrationState = (device: Device) => {
  const state = deviceService.calibrationState(device)
  const label = state === 'expired' ? '已过期' : state === 'due_soon' ? '即将到期' : '有效'
  return { state, label }
}

const resetFilters = () => {
  keyword.value = ''
  categoryFilter.value = ''
  statusFilter.value = ''
}

const dialogOpen = ref(false)
const editing = ref<Device | null>(null)
const formRef = ref<FormInstance>()

const emptyForm = (): DeviceInput => ({
  name: '',
  category: 'oscilloscope',
  model: '',
  serial: '',
  vendor: '',
  station: '',
  ownerId: app.currentUser.id,
  calibrationDate: new Date().toISOString().slice(0, 10),
  calibrationDue: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  status: 'available',
  attachments: [] as Attachment[],
})

const form = reactive<DeviceInput>(emptyForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  model: [{ required: true, message: '请输入型号', trigger: 'blur' }],
  serial: [{ required: true, message: '请输入序列号', trigger: 'blur' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
  calibrationDate: [{ required: true, message: '请选择校准日期', trigger: 'change' }],
  calibrationDue: [{ required: true, message: '请选择校准到期', trigger: 'change' }],
}

const openCreate = () => {
  editing.value = null
  Object.assign(form, emptyForm())
  dialogOpen.value = true
}

const openEdit = (device: Device) => {
  editing.value = device
  Object.assign(form, {
    name: device.name,
    category: device.category,
    model: device.model,
    serial: device.serial,
    vendor: device.vendor,
    station: device.station,
    ownerId: device.ownerId,
    calibrationDate: device.calibrationDate,
    calibrationDue: device.calibrationDue,
    status: device.status,
    attachments: device.attachments,
  })
  dialogOpen.value = true
}

const save = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (editing.value) {
    deviceService.update(editing.value.id, { ...form })
    ElMessage.success('设备已更新')
  } else {
    const created = deviceService.create({ ...form })
    ElMessage.success(`设备 ${created.code} 已创建`)
  }
  dialogOpen.value = false
}

const removeDevice = async (device: Device) => {
  try {
    await ElMessageBox.confirm(`删除设备 ${device.code}？已被计划/执行引用的设备不能删除。`, '删除设备', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    deviceService.remove(device.id)
    ElMessage.success('设备已删除')
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message)
  }
}

const drawerOpen = ref(false)
const active = ref<Device | null>(null)
const qrDataUrl = ref('')

const openDrawer = async (device: Device) => {
  active.value = device
  drawerOpen.value = true
  qrDataUrl.value = ''
  qrDataUrl.value = await QRCode.toDataURL(`benchflow://device/${device.code}`, {
    width: 148,
    margin: 1,
    color: { dark: '#1e3a5f', light: '#ffffff' },
  })
}

const repairDialog = ref(false)
const repairNote = ref('')
const repairCost = ref<number | null>(null)

const saveRepair = () => {
  if (!active.value) return
  if (!repairNote.value.trim()) {
    ElMessage.warning('请填写维修说明')
    return
  }
  deviceService.addRepair(active.value.id, repairNote.value, repairCost.value ?? undefined)
  repairDialog.value = false
  repairNote.value = ''
  repairCost.value = null
  ElMessage.success('维修记录已登记')
}

const exportCsv = () => {
  downloadText(
    `benchflow-devices-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsv(
      ['设备编号', '名称', '分类', '型号', '序列号', '厂商', '工位', '负责人', '校准日期', '校准到期', '状态', '使用次数'],
      filtered.value.map((d) => [
        d.code,
        d.name,
        deviceCategory.get(d.category).label,
        d.model,
        d.serial,
        d.vendor,
        d.station,
        memberName(d.ownerId),
        d.calibrationDate,
        d.calibrationDue,
        deviceStatus.get(d.status).label,
        deviceService.usageCount(d.id),
      ]),
    ),
  )
  ElMessage.success('已导出设备 CSV')
}

watch(drawerOpen, (open) => {
  if (!open) qrDataUrl.value = ''
})
</script>

<style scoped>
.alerts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 12px;
  border: 1px solid #f0dfc0;
  background: #fdf6ea;
  color: #80510a;
}

.alert.expired {
  background: #fdf1f0;
  border-color: #f2d5d1;
  color: #8f241b;
}

.alert span {
  flex: 1;
}

.device-link {
  border: none;
  background: none;
  padding: 0;
  font-size: 12.8px;
  font-weight: 550;
  color: var(--bf-ink);
  cursor: pointer;
  font-family: inherit;
}

.device-link:hover {
  color: var(--bf-accent);
  text-decoration: underline;
}

.cal {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.cal.expired {
  color: var(--bf-danger);
}

.cal.due_soon {
  color: var(--bf-warning);
}

.device-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: none;
}

.qr img {
  width: 96px;
  height: 96px;
  border: 1px solid var(--bf-border);
  border-radius: 4px;
  padding: 3px;
}

.block-title {
  font-size: 12.5px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: var(--bf-ink-2);
}

.usage-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.usage {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  padding-bottom: 5px;
  border-bottom: 1px dashed var(--bf-border);
  flex-wrap: wrap;
}

.link {
  color: var(--bf-accent);
  margin-left: auto;
}

.drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
