const total = db.sites.countDocuments({});
const active = db.sites.countDocuments({ status: 'ACTIVE' });
const withDept = db.sites.countDocuments({ department: { $exists: true, $ne: null } });
const inactive = db.sites.countDocuments({ status: { $ne: 'ACTIVE' } });
printjson({ total, active, withDept, inactive, catalogExpected: 36 });
