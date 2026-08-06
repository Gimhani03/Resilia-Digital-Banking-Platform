# Shared reverse-proxy settings for both API upstreams.
#
# Container Apps internal ingress serves TLS with a certificate valid for the
# app's internal FQDN, so SNI must carry that name — hence proxy_ssl_name /
# proxy_ssl_server_name rather than plain proxy_pass over http.

proxy_http_version 1.1;
proxy_set_header Connection "";
# $proxy_host is the real FQDN because proxy_pass targets it directly rather
# than an upstream block — see the note at the top of nginx.conf.template.
proxy_set_header Host $proxy_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
proxy_set_header X-Request-Id $request_id;

proxy_ssl_server_name on;
proxy_ssl_name $proxy_host;

proxy_connect_timeout 10s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;

# A cold-started replica can refuse the first connection; retry the next one
# rather than surfacing a 502 to the customer mid-transfer.
proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 2;
