// CloudFront Function (runtime cloudfront-js-2.0), viewer request, attached to
// the frontend distribution's default behaviour. docs/DEPLOY_AWS.md B5.
//
// Before pasting into the console, replace __DOMAIN__ (two places) with the
// apex domain, e.g. ceview.online.
//
// 1. www.__DOMAIN__ → 301 to https://__DOMAIN__, keeping path and query.
// 2. A path whose last segment has no file extension is a client-side route
//    (/enquiry, /dashboard/...), so serve /index.html and let React route it.

function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';

  if (host === 'www.__DOMAIN__') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://__DOMAIN__' + request.uri + buildQuery(request.querystring) }
      }
    };
  }

  var uri = request.uri;
  var last = uri.substring(uri.lastIndexOf('/') + 1);
  if (last.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}

function buildQuery(qs) {
  var parts = [];
  for (var key in qs) {
    var v = qs[key];
    if (v.multiValue) {
      for (var i = 0; i < v.multiValue.length; i++) {
        parts.push(key + '=' + v.multiValue[i].value);
      }
    } else {
      parts.push(key + '=' + v.value);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}
