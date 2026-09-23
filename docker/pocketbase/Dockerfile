FROM alpine:3.20

ARG PB_VERSION=0.25.9

RUN apk add --no-cache ca-certificates unzip wget \
  && wget -q -O /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  && unzip /tmp/pb.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/pocketbase \
  && rm /tmp/pb.zip \
  && mkdir -p /pb_data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8090
VOLUME ["/pb_data"]

ENTRYPOINT ["/entrypoint.sh"]
