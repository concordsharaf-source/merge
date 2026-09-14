import Handlebars from 'handlebars';

Handlebars.registerHelper('gt', function(a: number, b: number) {
  return (a ?? 0) > b;
});

Handlebars.registerHelper('calcTotal', function(item: any) {
  return (item.quantity || 0) * (item.unitPrice || 0);
});
