export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === "www.activemirror.ai") {
      url.hostname = "activemirror.ai";
      return Response.redirect(url.toString(), 308);
    }

    return env.ASSETS.fetch(request);
  },
};
