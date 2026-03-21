export const clusterComplaints = (complaints) => {
  const clusters = {};
  const WINDOW_MS = 7 * 24 * 3600000;
  const now = Date.now();
  complaints.filter(c => c.status !== 'resolved').forEach(c => {
    const created = c.createdAt?.toDate?.();
    if (!created || now - created.getTime() > WINDOW_MS) return;
    const key = `${c.floorNumber}-${c.category}`;
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(c);
  });
  return Object.entries(clusters)
    .filter(([, arr]) => arr.length >= 3)
    .map(([key, arr]) => ({
      key, floor: arr[0].floorNumber, building: arr[0].buildingName,
      category: arr[0].category, count: arr.length,
      affectedRooms: [...new Set(arr.map(c => c.roomNumber))],
      highestPriority: arr.some(c => c.priority === 'high') ? 'high'
        : arr.some(c => c.priority === 'medium') ? 'medium' : 'low',
      complaintIds: arr.map(c => c.id)
    }));
};
