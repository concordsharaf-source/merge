# ملاحظات تصميم مزامنة Firebase

- توضح وثائق Firestore الرسمية أن التخزين دون اتصال يتيح القراءة والكتابة والاستماع والاستعلام من البيانات المخزنة مؤقتًا، ثم يزامن التغييرات عند عودة الاتصال. في حال تعديل المستند نفسه عدة مرات، تكون القاعدة الافتراضية آخر كتابة هي المعتمدة.
- على الويب يكون التخزين المستمر معطلًا افتراضيًا، ويمكن تفعيله عبر `persistentLocalCache`. يدعم Firebase مدير تبويبات متعددًا عبر `persistentMultipleTabManager`، لكن ذلك يخص التبويبات/النوافذ على الجهاز نفسه، وليس بديلًا عن مزامنة جهازين مختلفين.
- المستمعات اللحظية عبر `onSnapshot` هي المسار المناسب لاستقبال تغييرات مجموعة المتجر عند حدوثها، مع تطبيق العملية الواردة على IndexedDB ثم إعادة تحديث الحسابات.

المصادر الرسمية:
1. https://firebase.google.com/docs/firestore/manage-data/enable-offline — Access data offline | Firestore
2. https://firebase.google.com/docs/firestore/query-data/listen — Get realtime updates with Cloud Firestore
