export const CONFERENCE_STATUS_OPTIONS = [
  { value: 'watching', label: '关注中', tone: 'neutral' },
  { value: 'preparing', label: '准备投稿', tone: 'amber' },
  { value: 'submitted', label: '已投稿', tone: 'blue' },
  { value: 'accepted', label: '已接收', tone: 'green' },
  { value: 'registered', label: '已注册', tone: 'violet' },
  { value: 'attending', label: '参会中', tone: 'orange' },
  { value: 'completed', label: '已结束', tone: 'neutral' },
  { value: 'rejected', label: '未接收', tone: 'red' },
  { value: 'withdrawn', label: '已撤回', tone: 'red' },
]

export const CONFERENCE_STATUS_MAP = Object.fromEntries(CONFERENCE_STATUS_OPTIONS.map((item) => [item.value, item]))

export const CITY_PRESETS = [
  ['北京', '中国', 116.4074, 39.9042], ['上海', '中国', 121.4737, 31.2304], ['香港', '中国', 114.1694, 22.3193],
  ['新加坡', '新加坡', 103.8198, 1.3521], ['东京', '日本', 139.6917, 35.6895], ['首尔', '韩国', 126.978, 37.5665],
  ['悉尼', '澳大利亚', 151.2093, -33.8688], ['墨尔本', '澳大利亚', 144.9631, -37.8136],
  ['伦敦', '英国', -0.1276, 51.5072], ['巴黎', '法国', 2.3522, 48.8566], ['阿姆斯特丹', '荷兰', 4.9041, 52.3676],
  ['柏林', '德国', 13.405, 52.52], ['慕尼黑', '德国', 11.582, 48.1351], ['维也纳', '奥地利', 16.3738, 48.2082],
  ['巴塞罗那', '西班牙', 2.1734, 41.3851], ['罗马', '意大利', 12.4964, 41.9028],
  ['纽约', '美国', -74.006, 40.7128], ['波士顿', '美国', -71.0589, 42.3601], ['华盛顿', '美国', -77.0369, 38.9072],
  ['芝加哥', '美国', -87.6298, 41.8781], ['西雅图', '美国', -122.3321, 47.6062], ['旧金山', '美国', -122.4194, 37.7749],
  ['洛杉矶', '美国', -118.2437, 34.0522], ['檀香山', '美国', -157.8583, 21.3069],
  ['温哥华', '加拿大', -123.1207, 49.2827], ['多伦多', '加拿大', -79.3832, 43.6532], ['蒙特利尔', '加拿大', -73.5673, 45.5017],
  ['圣保罗', '巴西', -46.6333, -23.5505], ['开普敦', '南非', 18.4241, -33.9249], ['迪拜', '阿联酋', 55.2708, 25.2048],
].map(([city, country, longitude, latitude]) => ({ city, country, longitude, latitude }))

export function conferenceDateState(conference, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const deadline = conference.submissionDeadline ? new Date(`${conference.submissionDeadline}T00:00:00`) : null
  const start = conference.startDate ? new Date(`${conference.startDate}T00:00:00`) : null
  const difference = (date) => date ? Math.round((date - day) / 86400000) : null
  return { deadlineDays: difference(deadline), startDays: difference(start) }
}

export function computeConferenceStats(conferences, now = new Date()) {
  const active = conferences.filter((item) => !['completed', 'rejected', 'withdrawn'].includes(item.status))
  const upcoming = conferences.filter((item) => item.startDate && new Date(`${item.startDate}T00:00:00`) >= now)
  const deadlineSoon = conferences.filter((item) => {
    const { deadlineDays } = conferenceDateState(item, now)
    return deadlineDays != null && deadlineDays >= 0 && deadlineDays <= 60 && ['watching', 'preparing'].includes(item.status)
  })
  const countries = new Set(conferences.map((item) => item.country).filter(Boolean))
  return {
    total: conferences.length,
    active: active.length,
    upcoming: upcoming.length,
    deadlineSoon: deadlineSoon.length,
    accepted: conferences.filter((item) => ['accepted', 'registered', 'attending', 'completed'].includes(item.status)).length,
    countries: countries.size,
  }
}

export function demoConferences() {
  return [
    {
      id: 'conference_demo_1', demo: true, name: 'Global Developmental Science Forum', acronym: 'GDSF 2027',
      field: 'Child Development', tier: 'International', status: 'preparing', city: '阿姆斯特丹', country: '荷兰',
      longitude: 4.9041, latitude: 52.3676, submissionDeadline: '2026-11-20', notificationDate: '2027-02-10',
      cameraReadyDate: '2027-03-08', startDate: '2027-06-16', endDate: '2027-06-19', url: 'https://example.com/conference', notes: '演示会议，可在数据管理中清除。',
    },
    {
      id: 'conference_demo_2', demo: true, name: 'Educational Data Methods Symposium', acronym: 'EDMS 2027',
      field: 'Educational AI', tier: 'International', status: 'watching', city: '新加坡', country: '新加坡',
      longitude: 103.8198, latitude: 1.3521, submissionDeadline: '2027-01-15', notificationDate: '2027-03-30',
      cameraReadyDate: '', startDate: '2027-07-08', endDate: '2027-07-11', url: 'https://example.com/symposium', notes: '演示会议。',
    },
  ]
}
