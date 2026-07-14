/* Figma Make 参考项目的数据等价移植。坐标为示意地图百分比，不是经纬度。 */
(function () {
  const guideNames = [
    ['g1', '县衙', 50, 15],
    ['g2', '报德祠', 30, 25],
    ['g3', '1820数字展厅', 70, 25],
    ['g4', '游客服务中心', 25, 40],
    ['g5', '关帝庙', 75, 40],
    ['g6', '南门', 50, 90],
    ['g7', '书院广场', 50, 45],
    ['g8', '五福临门', 15, 55],
    ['g9', '九街糖水', 85, 55],
    ['g10', '邓记传文', 20, 70],
    ['g11', '景之蓝', 80, 70],
    ['g12', '植物楼', 35, 80],
    ['g13', '党群中心', 65, 80],
    ['g14', 'if工厂', 30, 92],
    ['g15', '报德广场', 70, 92]
  ];

  const guides = guideNames.map(function (item, index) {
    const nextItem = guideNames[(index + 1) % guideNames.length];
    return {
      id: item[0], name: item[1], type: 'guide', x: item[2], y: item[3],
      nextGuideId: nextItem[0],
      hasSubtitles: true,
      icon: 'assets/figma-make/___' + (index + 1) + '.png'
    };
  });

  const services = [
    { id: 's1', name: '党群中心服务', type: 'service', x: 67, y: 78 },
    { id: 's2', name: '游客中心服务', type: 'service', x: 23, y: 38 },
    { id: 's3', name: '南门洗手间', type: 'wc', x: 45, y: 88 },
    { id: 's4', name: '广场洗手间', type: 'wc', x: 55, y: 45 },
    { id: 's5', name: '东门洗手间', type: 'wc', x: 85, y: 35 }
  ];

  const ramps = [
    { id: 'r1', name: '报德祠坡板', type: 'ramp', x: 28, y: 27 },
    { id: 'r2', name: '1820坡板', type: 'ramp', x: 72, y: 27 },
    { id: 'r3', name: '游客中心坡板', type: 'ramp', x: 27, y: 42 },
    { id: 'r4', name: '党群中心坡板', type: 'ramp', x: 63, y: 82 },
    { id: 'r5', name: '同源馆坡板', type: 'ramp', x: 50, y: 65 }
  ];

  const allPoints = guides.concat(services, ramps);
  const nearbyFacilityIds = ['s3', 's1', 'r5'];
  const nearbyFacilities = nearbyFacilityIds.map(function (id) {
    return allPoints.find(function (point) { return point.id === id; });
  });

  window.ZERO_MILE_DATA = {
    mapImage: 'assets/figma-make/018740dea30b01362c4a3f15d652f695.png',
    supportPhone: '',
    allPoints: allPoints,
    guides: guides,
    guideSequence: guides.map(function (guide) { return guide.id; }),
    nearbyFacilities: nearbyFacilities,
    filters: [
      { id: 'guide', label: '讲解点' },
      { id: 'service', label: '便民服务' },
      { id: 'accessible', label: '无障碍服务' }
    ]
  };
}());
