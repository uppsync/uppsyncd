# Use distroless as base image for a smaller, more secure image
FROM gcr.io/distroless/base-debian12:nonroot

LABEL org.opencontainers.image.source="https://github.com/uppsync/uppsyncd"

# Arguments automatically provided by docker buildx
ARG TARGETOS
ARG TARGETARCH

# Copy the binary specific to the target architecture
# The build context must be prepared with the structure: linux/amd64/uppsyncd, linux/arm64/uppsyncd
# Use --chmod to ensure execution permissions since distroless has no shell to run chmod
COPY --chmod=0755 ${TARGETOS}/${TARGETARCH}/uppsyncd /usr/local/bin/uppsyncd

# Run as nonroot user
# We use numeric user IDs for better compatibility with Kubernetes security policies
# The `nonroot` user in distroless maps to UID 65532
USER 65532:65532

ENTRYPOINT ["uppsyncd"]
CMD ["version"]
