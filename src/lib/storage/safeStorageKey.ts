// Supabase Storage (وكذلك S3 اللي بيشتغل عليه من تحت) بيرفض مفاتيح الملفات
// (object keys) اللي فيها حروف عربية أو رموز خاصة برسالة "Invalid key".
// المشكلة كانت إننا بنبني اسم الملف في الـ storage من اسم الملف الأصلي
// زي ما هو (${Date.now()}_${file.name})، فلو الموظف رفع ملف باسم عربي
// (زي "دليل الهوية المرئية.pdf") الرفع كان بيفشل فورًا.
//
// الحل: نفصل بين "اسم الملف المعروض للمستخدم" (بيفضل زي ما هو، متخزن في
// عمود منفصل في قاعدة البيانات) و"مفتاح التخزين" (اللي لازم يكون ASCII آمن
// بالكامل). الدالة دي بتاخد اسم الملف الأصلي وبترجع مفتاح آمن مع الحفاظ على
// الامتداد (extension) وجزء مقروء من الاسم للتتبع، وبتضيف رقم عشوائي لتفادي
// أي تصادم بين ملفين نفس التوقيت.
export function safeStorageKey(originalName: string, prefix?: string): string {
  const lastDot = originalName.lastIndexOf('.');
  const ext = lastDot > -1 ? originalName.slice(lastDot + 1).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) : '';
  const base = (lastDot > -1 ? originalName.slice(0, lastDot) : originalName)
    // نستبدل أي حرف مش لاتيني/رقم بـ "_" (بيشمل العربي والمسافات والرموز)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // نلغي التكرار الزايد للـ "_" عشان الاسم يفضل مقروء
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safeBase = base || 'file';
  const key = `${unique}_${safeBase}${ext ? `.${ext}` : ''}`;
  return prefix ? `${prefix}/${key}` : key;
}
